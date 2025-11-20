import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Goal, Target, Project, PomodoroHistory, Commitment, Task, ChatMessage, AiMemory, AiMemoryType } from '../types';
import { getTodayDateString } from '../utils/date';
import { runAgent, AgentContext, generateContent } from '../services/geminiService';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';
import { FunctionDeclaration, Type } from '@google/genai';
import { TrashIcon, BrainIcon, UserIcon, SparklesIcon, SendIcon } from '../components/common/Icons';

// Helper to format AI response from Markdown to HTML
function formatAIResponse(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^(?:\*|-)\s(.*?)$/gm, '<li>$1</li>')
        .replace(/(<\/li>\s*<li>)/g, '</li><li>')
        .replace(/(<li>.*?<\/li>)/gs, (match) => `<ul class="list-disc list-inside ml-4">${match}</ul>`)
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/\n/g, '<br>');
}

interface AICoachPageProps {
    goals: Goal[];
    targets: Target[];
    projects: Project[];
    allCommitments: Commitment[];
    onAddTask: (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null) => Promise<void>;
    onAddProject: (name: string, description: string | null, startDate: string | null, deadline: string | null, criteria: {type: Project['completion_criteria_type'], value: number | null}, priority: number | null, activeDays: number[] | null) => Promise<string | null>;
    onAddTarget: (text: string, deadline: string, priority: number | null) => Promise<void>;
    onAddCommitment: (text: string, dueDate: string | null) => Promise<void>;
    onRescheduleItem: (itemId: string, itemType: 'project' | 'target' | 'commitment', newDate: string | null) => Promise<void>;
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    aiMemories: AiMemory[];
    onMemoryChange: () => Promise<void>;
    onHistoryChange: () => Promise<void>;
}

// --- AI Function Declarations ---
const toolDeclarations: FunctionDeclaration[] = [
    {
        name: 'addTask',
        description: `Adds a new task to the user's to-do list. Tasks can be either standard countdown Pomodoros or count-up 'stopwatch' timers. When a due date is not specified, it defaults to today.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: 'The content or description of the task. Must be descriptive.' },
                poms: { type: Type.INTEGER, description: 'The estimated number of Pomodoro sessions required. Defaults to 1 for a standard task. For a stopwatch task that counts up, use a negative number (e.g., -1).' },
                dueDate: { type: Type.STRING, description: `The date the task is due, in YYYY-MM-DD format. Defaults to today if not specified.` },
                projectId: { type: Type.STRING, description: 'The ID of an existing project this task belongs to. Use null if no project.' },
                tags: { type: Type.ARRAY, description: 'A list of tags to categorize the task, e.g., ["research", "writing"].', items: { type: Type.STRING } },
                priority: { type: Type.INTEGER, description: 'An optional priority from 1 (highest) to 4 (lowest).' }
            },
            required: ['text']
        }
    },
    {
        name: 'addProject',
        description: 'Creates a new project for the user to group tasks under.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'The name of the new project.' },
                description: { type: Type.STRING, description: 'A brief description of the project.' },
                startDate: { type: Type.STRING, description: 'An optional start date for the project in YYYY-MM-DD format.' },
                deadline: { type: Type.STRING, description: 'The deadline for the project in YYYY-MM-DD format.' },
                criteriaType: { type: Type.STRING, enum: ['manual', 'task_count', 'duration_minutes'], description: 'The completion criteria type. Defaults to "manual".' },
                criteriaValue: { type: Type.INTEGER, description: 'The target value for task_count or duration_minutes criteria.' },
                priority: { type: Type.INTEGER, description: 'An optional priority from 1 (highest) to 4 (lowest).' },
                activeDays: { 
                    type: Type.ARRAY, 
                    description: 'An array of numbers (0-6, where Sunday is 0) for the days the project is active. If empty or null, it is active every day.', 
                    items: { type: Type.INTEGER } 
                },
            },
            required: ['name']
        }
    },
    {
        name: 'addTarget',
        description: 'Sets a new key target or milestone for the user.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: 'The description of the target.' },
                deadline: { type: Type.STRING, description: 'The deadline for the target in YYYY-MM-DD format.' },
                priority: { type: Type.INTEGER, description: 'An optional priority from 1 (highest) to 4 (lowest).' }
            },
            required: ['text', 'deadline']
        }
    },
    {
        name: 'addCommitment',
        description: 'Adds a new commitment or promise for the user.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: 'The text of the commitment.' },
                dueDate: { type: Type.STRING, description: 'An optional due date for the commitment in YYYY-MM-DD format.' }
            },
            required: ['text']
        }
    },
    {
        name: 'rescheduleItem',
        description: `Reschedules a due project, broken commitment, or incomplete target. This keeps the original failed item as a record and creates a new, active copy with a new deadline. The new item's name/text will be suffixed with '(rescheduled)'.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemId: { type: Type.STRING, description: 'The ID of the project, target, or commitment to reschedule.' },
                itemType: { type: Type.STRING, enum: ['project', 'target', 'commitment'], description: 'The type of item being rescheduled.' },
                newDate: { type: Type.STRING, description: `The new deadline or due date in YYYY-MM-DD format. This is required for targets, optional for projects and commitments.` }
            },
            required: ['itemId', 'itemType']
        }
    },
    {
        name: 'saveMemory',
        description: "Saves a new piece of important information to your long-term memory. Use this when the user shares new, contextually significant information you should remember. Use type 'personal' if the user explicitly uses @personal or shares personal facts (e.g. their field of study, a major upcoming event). Use type 'ai' if you, the AI, autonomously identify a key piece of context from the conversation that is important for future interactions.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                content: { type: Type.STRING, description: 'The concise piece of information to save.' },
                type: { type: Type.STRING, enum: ['personal', 'ai'], description: "The type of memory to save. 'personal' for user-provided facts, 'ai' for AI-inferred context."}
            },
            required: ['content', 'type']
        }
    },
    {
        name: 'updateMemory',
        description: "Updates an existing piece of personal or AI-inferred information in your memory when the user provides new, conflicting information. For example, if a memory says the user's goal is 'learn history' and they now say 'my goal is to learn physics', use this to update the old memory.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                memoryId: { type: Type.STRING, description: 'The ID of the memory entry to update. You MUST get this from the provided AI Memory Bank context.' },
                newContent: { type: Type.STRING, description: 'The new, updated content for the memory.' },
            },
            required: ['memoryId', 'newContent']
        }
    },
    {
        name: 'deleteMemory',
        description: "Deletes a specific memory entry from your memory bank when the user asks you to forget it. You must provide the exact ID of the memory to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                memoryId: { type: Type.STRING, description: 'The UUID of the memory entry to delete. You MUST get this from the provided AI Memory Bank context.' },
            },
            required: ['memoryId']
        }
    },
    {
        name: 'deletePomodoroHistory',
        description: "Deletes a specific Pomodoro session from the user's history log. This is a permanent action. You MUST ask the user for confirmation before using this tool.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                historyId: { type: Type.STRING, description: "The ID of the pomodoro_history entry to delete. You MUST find this ID from the Pomodoro History context data." },
            },
            required: ['historyId']
        }
    }
];

const AiMemoryManager: React.FC<{ memories: AiMemory[], onDelete: (id: string) => void }> = ({ memories, onDelete }) => {
    const groupedMemories = useMemo(() => {
        const groups: { [key in AiMemoryType]: AiMemory[] } = {
            learning: [],
            personal: [],
            ai: [],
        };
        memories.forEach(memory => {
            if (groups[memory.type]) {
                groups[memory.type].push(memory);
            }
        });
        return groups;
    }, [memories]);

    const typeInfo = {
        learning: { title: "Learnings", icon: <BrainIcon />, description: "Facts you've saved with @learn." },
        personal: { title: "Personal Context", icon: <UserIcon />, description: "Info you've told the AI to remember." },
        ai: { title: "AI Inferences", icon: <SparklesIcon />, description: "Context the AI has saved." }
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/80 p-4 sm:p-6">
            <h2 className="text-xl font-bold text-white text-center mb-2">🧠 AI Memory Bank</h2>
            <p className="text-white/80 text-center text-xs mb-4">Here is what I remember to provide you with personalized coaching. You can ask me to forget things at any time.</p>
            <div className="space-y-4 max-h-[calc(100vh-18rem)] overflow-y-auto pr-2">
                {(['learning', 'personal', 'ai'] as const).map(type => (
                    <div key={type}>
                        <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
                            <span className="text-teal-400">{typeInfo[type].icon}</span>
                            <span>{typeInfo[type].title}</span>
                        </h3>
                        <ul className="space-y-2">
                            {groupedMemories[type].length > 0 ? groupedMemories[type].map(memory => (
                                <li key={memory.id} className="bg-black/20 p-3 rounded-lg flex justify-between items-start gap-2 group transition-colors hover:bg-black/40">
                                    <div className="flex-grow">
                                        <p className="text-sm text-white/90">{memory.content}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-white/50">{new Date(memory.created_at).toLocaleDateString()}</span>
                                            {memory.tags && memory.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {memory.tags.map(tag => <span key={tag} className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">{tag}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => onDelete(memory.id)} className="p-1 text-red-400 hover:text-red-300 transition opacity-0 group-hover:opacity-100 flex-shrink-0" title="Delete Memory">
                                        <TrashIcon />
                                    </button>
                                </li>
                            )) : <p className="text-center text-xs text-white/50 p-2 italic bg-black/10 rounded-lg">No {type} memories yet.</p>}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

type FilterMode = 'all' | 'week' | 'month' | 'range';

const AICoachPage: React.FC<AICoachPageProps> = (props) => {
    const { goals, targets, projects, allCommitments, onAddTask, onAddProject, onAddTarget, onAddCommitment, onRescheduleItem, chatMessages, setChatMessages, aiMemories, onMemoryChange, onHistoryChange } = props;
    
    // Agent State
    const [userInput, setUserInput] = useState('');
    const [isAgentLoading, setIsAgentLoading] = useState(false);
    const [isMemoryBankVisible, setIsMemoryBankVisible] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Context Data State
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [contextTasks, setContextTasks] = useState<Task[]>([]);
    const [contextHistory, setContextHistory] = useState<PomodoroHistory[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        const fetchDataForContext = async () => {
            setIsDataLoading(true);
            let startDate = '';
            let endDate = '';
            const today = getTodayDateString();

            switch (filterMode) {
                case 'week':
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                    startDate = getTodayDateString(sevenDaysAgo);
                    endDate = today;
                    break;
                case 'month':
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                    startDate = getTodayDateString(thirtyDaysAgo);
                    endDate = today;
                    break;
                case 'range':
                    startDate = dateRange.start;
                    endDate = dateRange.end;
                    break;
                case 'all':
                default:
                    break;
            }
            
            if (filterMode === 'range' && (!startDate || !endDate || startDate > endDate)) {
                setContextTasks([]);
                setContextHistory([]);
                setIsDataLoading(false);
                return;
            }

            try {
                if (filterMode === 'all') {
                    const [fetchedTasks, fetchedHistory] = await Promise.all([
                        dbService.getAllTasksForStats(),
                        dbService.getAllPomodoroHistory()
                    ]);
                    setContextTasks(fetchedTasks || []);
                    setContextHistory(fetchedHistory || []);
                } else {
                    const [fetchedTasks, fetchedHistory] = await Promise.all([
                        dbService.getHistoricalTasks(startDate, endDate),
                        dbService.getPomodoroHistory(startDate, endDate)
                    ]);
                    setContextTasks(fetchedTasks || []);
                    setContextHistory(fetchedHistory || []);
                }
            } catch (error) {
                console.error("Error fetching data for AI context:", error);
            } finally {
                setIsDataLoading(false);
            }
        };

        fetchDataForContext();
    }, [filterMode, dateRange]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isAgentLoading]);
    
     useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [userInput]);

    const handleDeleteMemory = async (id: string) => {
        if (window.confirm("Are you sure you want the AI to forget this memory? This action cannot be undone.")) {
            const success = await dbService.deleteAiMemory(id);
            if (success) {
                await onMemoryChange();
            } else {
                alert("Failed to delete memory. Please try again.");
            }
        }
    };

    const handleSaveContextualMemory = async (content: string, type: 'personal' | 'ai') => {
        const contextualMemories = aiMemories.filter(m => m.type === 'personal' || m.type === 'ai');
        
        if (contextualMemories.length < 30) {
            await dbService.addAiMemory(type, content, null);
        } else {
            const sortedMemories = contextualMemories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const memoryList = sortedMemories
                .map((m, i) => `${i + 1}. (ID: ${m.id}) [${m.type.toUpperCase()}] ${m.content}`)
                .join('\n');
            
            const utilityPrompt = `
                Your contextual memory bank for this user is full (30 entries). You need to make space for a new memory by deleting the LEAST relevant existing one.
                Review the existing memories and the new one below. Which of the existing memories is the most outdated or least important now?
                Respond with ONLY the UUID of the memory to delete. Do not add any other text.

                EXISTING MEMORIES (oldest first):
                ${memoryList}

                NEW MEMORY TO ADD:
                [${type.toUpperCase()}] ${content}

                UUID of memory to delete:
            `;

            const idToDelete = await generateContent(utilityPrompt);

            if (idToDelete && idToDelete.trim().length > 10) {
                const deleted = await dbService.deleteAiMemory(idToDelete.trim());
                if(deleted) {
                    await dbService.addAiMemory(type, content, null);
                } else {
                    console.error("Failsafe: AI-suggested memory deletion failed. New memory was not added.");
                }
            } else {
                 console.warn("AI did not return a valid ID to delete. Deleting the oldest memory as a fallback.");
                 const oldestMemoryId = sortedMemories[0]?.id;
                 if (oldestMemoryId) {
                     await dbService.deleteAiMemory(oldestMemoryId);
                     await dbService.addAiMemory(type, content, null);
                 }
            }
        }
        await onMemoryChange();
    };
    
    const handleAgentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isAgentLoading) return;

        const userText = userInput.trim();
        setUserInput('');
        
        const personalRegex = /^@personal\s(.+)/i;
        const personalMatch = userText.match(personalRegex);

        if (personalMatch && personalMatch[1]) {
            const content = personalMatch[1];
            setIsAgentLoading(true);
            setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
            await handleSaveContextualMemory(content, 'personal');
            setChatMessages(prev => [...prev, { role: 'model', text: `Got it. I've saved that to my personal memory.` }]);
            setIsAgentLoading(false);
            return;
        }

        const newUserMessage: ChatMessage = { role: 'user', text: userText };
        const currentMessages = [...chatMessages, newUserMessage];
        setChatMessages(currentMessages);
        setIsAgentLoading(true);

        const historyForApi = currentMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));
        
        const historyToSend = [...historyForApi];
        if (historyToSend.length > 0 && historyToSend[0].role === 'model') {
            historyToSend.shift();
        }

        const dailyLogsMap = new Map<string, { date: string, total_focus_minutes: number, completed_sessions: number }>();
        contextHistory.forEach(p => {
            const date = getTodayDateString(new Date(p.ended_at)); // Use local date string
            if (!dailyLogsMap.has(date)) {
                dailyLogsMap.set(date, { date, total_focus_minutes: 0, completed_sessions: 0 });
            }
            const log = dailyLogsMap.get(date)!;
            log.total_focus_minutes += Number(p.duration_minutes) || 0;
            log.completed_sessions += 1;
        });
        contextTasks.forEach(t => {
            const date = t.due_date;
            if (!dailyLogsMap.has(date)) {
                dailyLogsMap.set(date, { date, total_focus_minutes: 0, completed_sessions: 0 });
            }
        });
        const dailyLogs = Array.from(dailyLogsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        let dateRangeDescription = 'all of the user\'s history';
        switch (filterMode) {
            case 'week':
                dateRangeDescription = 'the last 7 days';
                break;
            case 'month':
                dateRangeDescription = 'the last 30 days';
                break;
            case 'range':
                if (dateRange.start && dateRange.end) {
                    dateRangeDescription = `the period from ${dateRange.start} to ${dateRange.end}`;
                }
                break;
        }

        const agentContext: AgentContext = {
            goals: goals.map(g => ({ id: g.id, text: g.text })),
            targets: targets.map(t => ({ id: t.id, text: t.text, deadline: t.deadline, completed_at: t.completed_at, priority: t.priority })),
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                status: p.status,
                start_date: p.start_date,
                deadline: p.deadline,
                completion_criteria_type: p.completion_criteria_type,
                completion_criteria_value: p.completion_criteria_value,
                progress_value: p.progress_value,
                priority: p.priority,
                active_days: p.active_days
            })),
            commitments: allCommitments.map(c => ({ id: c.id, text: c.text, due_date: c.due_date })),
            tasks: contextTasks.map(t => ({
                id: t.id,
                text: t.text,
                due_date: t.due_date,
                completed_at: t.completed_at,
                project_id: t.project_id,
                completed_poms: t.completed_poms,
                total_poms: t.total_poms,
                comments: t.comments,
                priority: t.priority,
                tags: t.tags,
            })),
            dailyLogs,
            pomodoroHistory: contextHistory.map(p => ({ id: p.id, task_id: p.task_id, ended_at: p.ended_at, duration_minutes: p.duration_minutes })),
            aiMemories: aiMemories.map(m => ({ id: m.id, type: m.type, content: m.content, tags: m.tags, created_at: m.created_at })),
            dateRangeDescription,
        };


        try {
            const response = await runAgent(historyToSend, toolDeclarations, agentContext);
            
            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                // For simplicity, handling one function call at a time
                const call = functionCalls[0];
                const { name, args } = call;
                let functionResultPayload;

                try {
                    // FIX: Cast `unknown` args from Gemini function calls to their expected types.
                    if (name === 'addTask') {
                        await onAddTask(args.text as string, (args.poms as number) || 1, (args.dueDate as string) || getTodayDateString(), (args.projectId as string) || null, (args.tags as string[]) || [], (args.priority as number) || null);
                        functionResultPayload = { success: true, message: `Task "${args.text as string}" added.` };
                    } else if (name === 'addProject') {
                        await onAddProject(args.name as string, (args.description as string) || null, (args.startDate as string) || null, (args.deadline as string) || null, {type: (args.criteriaType as Project['completion_criteria_type']) || 'manual', value: (args.criteriaValue as number) || null}, (args.priority as number) || null, (args.activeDays as number[]) || null);
                        functionResultPayload = { success: true, message: `Project "${args.name as string}" created.` };
                    } else if (name === 'addTarget') {
                        await onAddTarget(args.text as string, args.deadline as string, (args.priority as number) || null);
                        functionResultPayload = { success: true, message: `Target "${args.text as string}" set for ${args.deadline as string}.` };
                    } else if (name === 'addCommitment') {
                        await onAddCommitment(args.text as string, (args.dueDate as string) || null);
                        functionResultPayload = { success: true, message: `Commitment "${args.text as string}" recorded.` };
                    } else if (name === 'rescheduleItem') {
                        await onRescheduleItem(args.itemId as string, args.itemType as 'project' | 'target' | 'commitment', (args.newDate as string) || null);
                        functionResultPayload = { success: true, message: `The ${args.itemType as string} has been successfully rescheduled.` };
                    } else if (name === 'saveMemory') {
                        await handleSaveContextualMemory(args.content as string, args.type as 'personal' | 'ai');
                        functionResultPayload = { success: true, message: `Memory saved.` };
                    } else if (name === 'updateMemory') {
                        await dbService.updateAiMemory(args.memoryId as string, { content: args.newContent as string });
                        await onMemoryChange();
                        functionResultPayload = { success: true, message: `Memory updated.` };
                    } else if (name === 'deleteMemory') {
                        const deleted = await dbService.deleteAiMemory(args.memoryId as string);
                        if (deleted) {
                            await onMemoryChange();
                            functionResultPayload = { success: true, message: `Memory with ID ${args.memoryId as string} has been deleted.` };
                        } else {
                            functionResultPayload = { success: false, message: `Failed to delete memory with ID ${args.memoryId as string}.` };
                        }
                    } else if (name === 'deletePomodoroHistory') {
                        const historyId = args.historyId as string;
                        
                        // Find the item in the context to show details in the confirmation.
                        const historyItem = agentContext.pomodoroHistory.find(h => h.id === historyId);
                        const confirmationMessage = historyItem
                            ? `Are you sure you want to permanently delete this Pomodoro session?\n\nEnded at: ${new Date(historyItem.ended_at).toLocaleString()}\nDuration: ${historyItem.duration_minutes}m\n\nThis action cannot be undone.`
                            : `Are you sure you want to permanently delete the Pomodoro session with ID ${historyId}? This action cannot be undone.`;

                        if (window.confirm(confirmationMessage)) {
                            const success = await dbService.deletePomodoroHistoryById(historyId);
                            if (success) {
                                await onHistoryChange();
                                functionResultPayload = { success: true, message: `The Pomodoro session was successfully deleted.` };
                            } else {
                                functionResultPayload = { success: false, message: `Failed to delete the Pomodoro session. It might have been already deleted or an error occurred.` };
                            }
                        } else {
                            functionResultPayload = { success: false, message: 'User cancelled the deletion.' };
                        }
                    } else {
                        functionResultPayload = { success: false, message: `Unknown function: ${name}` };
                    }
                } catch (toolError) {
                    functionResultPayload = { success: false, message: `Error executing function ${name}: ${toolError instanceof Error ? toolError.message : String(toolError)}` };
                }

                const historyWithFunctionCall = [...historyToSend, { role: 'model' as const, parts: [{ functionCall: call }] }];
                const historyWithFunctionResponse = [...historyWithFunctionCall, {
                    role: 'function' as const,
                    parts: [{ functionResponse: { name, response: functionResultPayload } }]
                }];

                const finalResponse = await runAgent(historyWithFunctionResponse, toolDeclarations, agentContext);
                setChatMessages(prev => [...prev, { role: 'model', text: finalResponse.text }]);
            } else {
                setChatMessages(prev => [...prev, { role: 'model', text: response.text }]);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setChatMessages(prev => [...prev, { role: 'model', text: `Sorry, I ran into an error: ${errorMessage}` }]);
        } finally {
            setIsAgentLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAgentSubmit(e as any);
        }
    };


    return (
        <>
            <div className={`grid grid-cols-1 ${isMemoryBankVisible ? 'lg:grid-cols-3 lg:gap-6' : ''}`}>
                <div className={`${isMemoryBankVisible ? 'lg:col-span-2' : ''}`}>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/80 flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
                        <div className="p-4 border-b border-slate-700/80 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">🤖 AI Coach</h2>
                            <button
                                onClick={() => setIsMemoryBankVisible(v => !v)}
                                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-700/50 px-3 py-2 rounded-lg transition-colors"
                                aria-expanded={isMemoryBankVisible}
                            >
                                <BrainIcon />
                                <span>{isMemoryBankVisible ? 'Hide Memory' : 'Show Memory'}</span>
                            </button>
                        </div>
                        {/* Context Header */}
                        <div className="relative p-3 bg-slate-900/30 border-b border-slate-700/80 z-10">
                            <div className="flex justify-center gap-1 mb-2 bg-black/20 p-1 rounded-full max-w-md mx-auto text-sm">
                                {(['all', 'week', 'month', 'range'] as FilterMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setFilterMode(mode)}
                                        className={`flex-1 p-2 rounded-full font-bold transition-colors ${filterMode === mode ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                                    >
                                        {mode === 'all' ? 'All Time' : mode === 'week' ? 'This Week' : mode === 'month' ? 'This Month' : 'Range'}
                                    </button>
                                ))}
                            </div>
                            {filterMode === 'range' && (
                                <div className="flex items-center justify-center gap-2 mt-2 animate-fadeIn">
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="bg-white/10 border border-white/20 rounded-lg p-2 text-white/80 text-sm text-center" style={{colorScheme: 'dark'}} />
                                    <span className="text-white/70">to</span>
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="bg-white/10 border border-white/20 rounded-lg p-2 text-white/80 text-sm text-center" style={{colorScheme: 'dark'}} />
                                </div>
                            )}
                            {isDataLoading && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-400 animate-pulse"></div>}
                        </div>
                        
                        {/* Chat History */}
                        <div className="flex-grow overflow-y-auto p-4 space-y-6">
                            {chatMessages.map((msg, index) => {
                                if (msg.role === 'user') {
                                    return (
                                        <div key={index} className="flex items-end gap-3 justify-end animate-slideUp">
                                            <div className="max-w-sm md:max-w-lg lg:max-w-xl p-3 rounded-b-xl rounded-tl-xl text-white shadow-md bg-teal-600">
                                                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.text) }} />
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shadow-lg flex-shrink-0 text-lg">👤</div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={index} className="flex items-start gap-3 animate-slideUp">
                                        <div className="w-8 h-8 rounded-full bg-teal-500/80 flex items-center justify-center shadow-lg flex-shrink-0 text-lg">🤖</div>
                                        <div className="max-w-sm md:max-w-lg lg:max-w-xl p-3 rounded-b-xl rounded-tr-xl text-white shadow-md bg-slate-700">
                                            <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.text) }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {isAgentLoading && (
                                <div className="flex items-start gap-3 animate-slideUp">
                                    <div className="w-8 h-8 rounded-full bg-teal-500/80 flex items-center justify-center shadow-lg flex-shrink-0 text-lg">🤖</div>
                                    <div className="p-3 rounded-b-xl rounded-tr-xl bg-slate-700 text-white">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 bg-white/70 rounded-full animate-bounce-dots" style={{ animationDelay: '0s' }}></span>
                                            <span className="w-2.5 h-2.5 bg-white/70 rounded-full animate-bounce-dots" style={{ animationDelay: '0.2s' }}></span>
                                            <span className="w-2.5 h-2.5 bg-white/70 rounded-full animate-bounce-dots" style={{ animationDelay: '0.4s' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Form */}
                        <div className="p-4 bg-slate-900/50 border-t border-slate-700/80">
                            <form onSubmit={handleAgentSubmit} className="relative flex items-end gap-2">
                                <textarea
                                    ref={textareaRef}
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Message your AI Coach..."
                                    rows={1}
                                    disabled={isAgentLoading || isDataLoading}
                                    className="flex-grow bg-slate-700/50 border border-slate-600 rounded-2xl py-3 px-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 transition resize-none max-h-40 overflow-y-auto"
                                />
                                <button
                                    type="submit"
                                    disabled={isAgentLoading || isDataLoading || !userInput.trim()}
                                    className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                                    aria-label="Send message"
                                >
                                    <SendIcon />
                                </button>
                            </form>
                            <p className="text-center text-xs text-slate-500 mt-2 px-2">Use <code>@personal</code> to save key info. E.g., <code>@personal My main goal is to finish my thesis.</code></p>
                        </div>
                    </div>
                </div>
                
                {isMemoryBankVisible && (
                    <div className="mt-6 lg:mt-0 lg:col-span-1 animate-slideUp">
                        <AiMemoryManager memories={aiMemories} onDelete={handleDeleteMemory} />
                    </div>
                )}
            </div>
            <style>{`
              .prose-invert ul { margin-top: 0.5em; margin-bottom: 0.5em; }
              .prose-invert li { margin-top: 0.2em; margin-bottom: 0.2em; }
            `}</style>
        </>
    );
};

export default AICoachPage;
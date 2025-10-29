import React, { useState, useEffect, useRef } from 'react';
import { Goal, Target, Project, PomodoroHistory, Commitment, Task, ChatMessage, AiMemory } from '../types';
import { getTodayDateString } from '../utils/date';
import { runAgent, AgentContext, generateContent } from '../services/geminiService';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';
import { FunctionDeclaration, Type } from '@google/genai';
import Panel from '../components/common/Panel';

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
    onAddTask: (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[]) => Promise<void>;
    onAddProject: (name: string, description: string | null, deadline: string | null, criteria?: {type: Project['completion_criteria_type'], value: number | null}) => Promise<string | null>;
    onAddTarget: (text: string, deadline: string) => Promise<void>;
    onAddCommitment: (text: string, dueDate: string | null) => Promise<void>;
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    aiMemories: AiMemory[];
    onMemoryChange: () => Promise<void>;
}

const getMonthAgoDateString = (): string => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return getTodayDateString(date);
};

// --- AI Function Declarations ---
const toolDeclarations: FunctionDeclaration[] = [
    {
        name: 'addTask',
        description: `Adds a new task to the user's to-do list. When a due date is not specified, it defaults to today. When poms (pomodoro sessions) are not specified, it defaults to 1.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: 'The content or description of the task. Must be descriptive.' },
                poms: { type: Type.INTEGER, description: 'The estimated number of Pomodoro sessions required. Defaults to 1.' },
                dueDate: { type: Type.STRING, description: `The date the task is due, in YYYY-MM-DD format. Defaults to today if not specified.` },
                projectId: { type: Type.STRING, description: 'The ID of an existing project this task belongs to. Use null if no project.' },
                tags: { type: Type.ARRAY, description: 'A list of tags to categorize the task, e.g., ["research", "writing"].', items: { type: Type.STRING } }
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
                deadline: { type: Type.STRING, description: 'The deadline for the project in YYYY-MM-DD format.' },
                criteriaType: { type: Type.STRING, enum: ['manual', 'task_count', 'duration_minutes'], description: 'The completion criteria type. Defaults to "manual".' },
                criteriaValue: { type: Type.INTEGER, description: 'The target value for task_count or duration_minutes criteria.' }
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
                deadline: { type: Type.STRING, description: 'The deadline for the target in YYYY-MM-DD format.' }
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
    }
];

const AICoachPage: React.FC<AICoachPageProps> = (props) => {
    const { goals, targets, projects, allCommitments, onAddTask, onAddProject, onAddTarget, onAddCommitment, chatMessages, setChatMessages, aiMemories, onMemoryChange } = props;
    
    // Agent State
    const [userInput, setUserInput] = useState('');
    const [isAgentLoading, setIsAgentLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // Context Data State
    const [historyRange, setHistoryRange] = useState(() => ({
        start: getMonthAgoDateString(),
        end: getTodayDateString(),
    }));
    const [tasksInRange, setTasksInRange] = useState<Task[]>([]);
    const [pomodoroHistoryInRange, setPomodoroHistoryInRange] = useState<PomodoroHistory[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        const fetchRangedData = async () => {
            setIsDataLoading(true);
            const [fetchedTasks, fetchedHistory] = await Promise.all([
                 dbService.getHistoricalTasks(historyRange.start, historyRange.end),
                 dbService.getPomodoroHistory(historyRange.start, historyRange.end)
            ]);
            setTasksInRange(fetchedTasks || []);
            setPomodoroHistoryInRange(fetchedHistory || []);
            setIsDataLoading(false);
        };

        if (historyRange.start && historyRange.end && new Date(historyRange.start) <= new Date(historyRange.end)) {
            fetchRangedData();
        } else {
            setTasksInRange([]);
            setPomodoroHistoryInRange([]);
            setIsDataLoading(false);
        }
    }, [historyRange]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

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

        pomodoroHistoryInRange.forEach(p => {
            const date = p.ended_at.split('T')[0];
            if (!dailyLogsMap.has(date)) {
                dailyLogsMap.set(date, { date, total_focus_minutes: 0, completed_sessions: 0 });
            }
            const log = dailyLogsMap.get(date)!;
            log.total_focus_minutes += Number(p.duration_minutes) || 0;
            log.completed_sessions += 1;
        });

        tasksInRange.forEach(t => {
            const date = t.due_date;
            if (!dailyLogsMap.has(date)) {
                dailyLogsMap.set(date, { date, total_focus_minutes: 0, completed_sessions: 0 });
            }
        });

        const dailyLogs = Array.from(dailyLogsMap.values()).sort((a, b) => a.date.localeCompare(b.date));


        const agentContext: AgentContext = {
            goals: goals.map(g => ({ id: g.id, text: g.text })),
            targets: targets.map(t => ({ id: t.id, text: t.text, deadline: t.deadline, completed_at: t.completed_at })),
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                status: p.status,
                deadline: p.deadline,
                completion_criteria_type: p.completion_criteria_type,
                completion_criteria_value: p.completion_criteria_value,
                progress_value: p.progress_value,
            })),
            commitments: allCommitments.map(c => ({ id: c.id, text: c.text, due_date: c.due_date })),
            tasks: tasksInRange.map(t => ({
                id: t.id,
                text: t.text,
                due_date: t.due_date,
                completed_at: t.completed_at,
                project_id: t.project_id,
                completed_poms: t.completed_poms,
                total_poms: t.total_poms,
            })),
            dailyLogs,
            aiMemories: aiMemories.map(m => ({ id: m.id, type: m.type, content: m.content, tags: m.tags, created_at: m.created_at })),
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
                    if (name === 'addTask') {
                        await onAddTask(args.text, args.poms || 1, args.dueDate || getTodayDateString(), args.projectId || null, args.tags || []);
                        functionResultPayload = { success: true, message: `Task "${args.text}" added.` };
                    } else if (name === 'addProject') {
                        await onAddProject(args.name, args.description || null, args.deadline || null, {type: args.criteriaType || 'manual', value: args.criteriaValue || null});
                        functionResultPayload = { success: true, message: `Project "${args.name}" created.` };
                    } else if (name === 'addTarget') {
                        await onAddTarget(args.text, args.deadline);
                        functionResultPayload = { success: true, message: `Target "${args.text}" set for ${args.deadline}.` };
                    } else if (name === 'addCommitment') {
                        await onAddCommitment(args.text, args.dueDate || null);
                        functionResultPayload = { success: true, message: `Commitment "${args.text}" recorded.` };
                    } else if (name === 'saveMemory') {
                        await handleSaveContextualMemory(args.content, args.type);
                        functionResultPayload = { success: true, message: `Memory saved.` };
                    } else if (name === 'updateMemory') {
                        await dbService.updateAiMemory(args.memoryId, { content: args.newContent });
                        await onMemoryChange();
                        functionResultPayload = { success: true, message: `Memory updated.` };
                    } else if (name === 'deleteMemory') {
                        const deleted = await dbService.deleteAiMemory(args.memoryId);
                        if (deleted) {
                            await onMemoryChange();
                            functionResultPayload = { success: true, message: `Memory with ID ${args.memoryId} has been deleted.` };
                        } else {
                            functionResultPayload = { success: false, message: `Failed to delete memory with ID ${args.memoryId}.` };
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


    return (
        <Panel title="🤖 AI Coach">
             <div className="flex flex-col h-[calc(80vh-120px)] md:h-[calc(100vh-200px)] -m-4 sm:-m-6">
                {/* Context Header */}
                <div className="relative p-4 pt-0 bg-slate-900/30 border-b border-slate-700/80 z-10">
                    <p className="text-center text-xs text-white/60 mb-2">Provide a date range for performance context.</p>
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                        <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-slate-700/50 border border-slate-600 rounded-lg p-2 text-white/80 w-full text-center text-xs" style={{colorScheme: 'dark'}}/>
                        <span className="text-white/80 text-xs">to</span>
                        <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-slate-700/50 border border-slate-600 rounded-lg p-2 text-white/80 w-full text-center text-xs" style={{colorScheme: 'dark'}}/>
                    </div>
                     {isDataLoading && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-400 animate-pulse"></div>}
                </div>
                
                {/* Chat History */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {chatMessages.map((msg, index) => (
                         <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center shadow-lg flex-shrink-0">🤖</div>
                            )}
                            <div className={`max-w-xs md:max-w-md p-3 rounded-2xl text-white shadow-md ${msg.role === 'user' ? 'bg-teal-600 rounded-br-none' : 'bg-slate-700 rounded-bl-none'}`}>
                                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.text) }} />
                            </div>
                        </div>
                    ))}
                    {isAgentLoading && (
                         <div className="flex items-end gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center shadow-lg flex-shrink-0">🤖</div>
                            <div className="p-3 rounded-2xl bg-slate-700 rounded-bl-none text-white">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                    <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                    <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Form */}
                 <div className="p-3 bg-slate-900/50 border-t border-slate-700/80 z-10">
                     <form onSubmit={handleAgentSubmit} className="relative flex gap-3">
                        <input
                            type="text"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            placeholder="Message your AI Coach..."
                            disabled={isAgentLoading || isDataLoading}
                            className="flex-grow bg-slate-700/50 border border-slate-600 rounded-full py-2 px-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 transition"
                        />
                        <button type="submit" disabled={isAgentLoading || isDataLoading || !userInput.trim()} className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                        </button>
                    </form>
                    <p className="text-center text-xs text-slate-500 mt-2 px-2">Use <code>@personal</code> to save key info. E.g., <code>@personal My main goal is to finish my thesis.</code></p>
                 </div>
            </div>
            <style>{`
              .prose-invert ul { margin-top: 0.5em; margin-bottom: 0.5em; }
              .prose-invert li { margin-top: 0.2em; margin-bottom: 0.2em; }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
              }
              .animate-bounce { animation: bounce 1s infinite ease-in-out; }
            `}</style>
        </Panel>
    );
};

export default AICoachPage;
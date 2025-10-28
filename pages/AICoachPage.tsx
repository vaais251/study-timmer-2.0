import React, { useState, useEffect, useRef } from 'react';
import { Goal, Target, Project, PomodoroHistory, Commitment, Task, ChatMessage } from '../types';
import { getTodayDateString } from '../utils/date';
import { runAgent, AgentContext } from '../services/geminiService';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';
import { FunctionDeclaration, Type } from '@google/genai';

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
    }
];

const AICoachPage: React.FC<AICoachPageProps> = (props) => {
    const { goals, targets, projects, allCommitments, onAddTask, onAddProject, onAddTarget, onAddCommitment, chatMessages, setChatMessages } = props;
    
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
    
    const handleAgentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isAgentLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', text: userInput };
        const currentMessages = [...chatMessages, newUserMessage];
        setChatMessages(currentMessages);
        setUserInput('');
        setIsAgentLoading(true);

        const historyForApi = currentMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));
        
        // The API requires conversations to start with a 'user' role.
        // The initial greeting message is from the 'model' for UI purposes.
        // We remove it from the history sent to the API to ensure a valid conversation sequence.
        const historyToSend = [...historyForApi];
        if (historyToSend.length > 0 && historyToSend[0].role === 'model') {
            historyToSend.shift();
        }

        const dailyLogsMap = new Map<string, { date: string, total_focus_minutes: number, completed_sessions: number }>();

        // Aggregate focus time and sessions from pomodoro history
        pomodoroHistoryInRange.forEach(p => {
            const date = p.ended_at.split('T')[0];
            if (!dailyLogsMap.has(date)) {
                dailyLogsMap.set(date, { date, total_focus_minutes: 0, completed_sessions: 0 });
            }
            const log = dailyLogsMap.get(date)!;
            log.total_focus_minutes += Number(p.duration_minutes) || 0;
            log.completed_sessions += 1;
        });

        // Ensure days with tasks but no focus time are included, so the AI knows about planned but unworked days.
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
        };


        try {
            const response = await runAgent(historyToSend, toolDeclarations, agentContext);
            
            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
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
        <>
            <div className="ai-coach-container relative bg-slate-900 rounded-2xl overflow-hidden flex flex-col h-[75vh]">
                <div className="animated-gradient absolute inset-0"></div>
                {/* Header */}
                <div className="relative p-3 bg-black/30 backdrop-blur-sm border-b border-white/10 z-10">
                    <h2 className="text-lg font-bold text-white text-center mb-2 flex items-center justify-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">🤖</span>
                        AI Coach
                    </h2>
                    <p className="text-center text-xs text-white/60 mb-2">Provide a date range for performance context.</p>
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                        <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/10 border border-white/20 rounded-lg p-1 text-white/80 w-full text-center text-xs" style={{colorScheme: 'dark'}}/>
                        <span className="text-white/80 text-xs">to</span>
                        <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/10 border border-white/20 rounded-lg p-1 text-white/80 w-full text-center text-xs" style={{colorScheme: 'dark'}}/>
                    </div>
                     {isDataLoading && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 animate-pulse"></div>}
                </div>
                
                {/* Chat History */}
                <div className="relative flex-grow overflow-y-auto p-4 space-y-4">
                    {chatMessages.map((msg, index) => (
                         <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">🤖</div>
                            )}
                            <div className={`max-w-xs md:max-w-md p-3 rounded-2xl text-white shadow-md ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-cyan-500 rounded-br-none' : 'bg-slate-700 rounded-bl-none'}`}>
                                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.text) }} />
                            </div>
                        </div>
                    ))}
                    {isAgentLoading && (
                         <div className="flex items-end gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">🤖</div>
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
                 <form onSubmit={handleAgentSubmit} className="relative flex gap-3 p-3 bg-slate-800/50 border-t border-white/10 z-10">
                    <input
                        type="text"
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        placeholder="Message your AI Coach..."
                        disabled={isAgentLoading || isDataLoading}
                        className="flex-grow bg-slate-900/70 border border-white/20 rounded-full py-2 px-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
                    />
                    <button type="submit" disabled={isAgentLoading || isDataLoading || !userInput.trim()} className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                    </button>
                </form>
            </div>
            <style>{`
              .prose-invert ul { margin-top: 0.5em; margin-bottom: 0.5em; }
              .prose-invert li { margin-top: 0.2em; margin-bottom: 0.2em; }
              .animated-gradient {
                background: linear-gradient(-45deg, #1e1b4b, #312e81, #4f46e5, #3b0764);
                background-size: 400% 400%;
                animation: gradient-animation 15s ease infinite;
              }
              @keyframes gradient-animation {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
              }
              .animate-bounce { animation: bounce 1s infinite ease-in-out; }
            `}</style>
        </>
    );
};

export default AICoachPage;
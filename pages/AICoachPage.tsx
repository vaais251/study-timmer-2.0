

import React, { useState, useEffect } from 'react';
import { Task, Goal, Target, Project } from '../types';
import { getTodayDateString } from '../utils/date';
import { generateContent } from '../services/geminiService';
import * as dbService from '../services/dbService';
import AIPanel from '../components/AIPanel';
import Panel from '../components/common/Panel';
import Spinner from '../components/common/Spinner';

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
}

const getMonthAgoDateString = (): string => {
    const date = new Date();
    // Set the date to one month ago from today.
    date.setMonth(date.getMonth() - 1);
    return getTodayDateString(date);
};

const AICoachPage: React.FC<AICoachPageProps> = ({ goals, targets, projects }) => {
    const [insightsState, setInsightsState] = useState({ content: "Get AI-powered insights on your study habits based on your selected performance.", isLoading: false });
    const [mentorState, setMentorState] = useState({ content: "Get personalized advice, content suggestions, and consistency tips.", isLoading: false });
    const [historyRange, setHistoryRange] = useState(() => ({
        start: getMonthAgoDateString(),
        end: getTodayDateString(),
    }));
    
    const [tasksInRange, setTasksInRange] = useState<Task[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isTaskListVisible, setIsTaskListVisible] = useState(false);
    const [allowCommentAccess, setAllowCommentAccess] = useState(false);

    useEffect(() => {
        const fetchTasksForRange = async () => {
            setIsDataLoading(true);
            const fetchedTasks = await dbService.getHistoricalTasks(historyRange.start, historyRange.end);
            setTasksInRange(fetchedTasks || []);
            setIsDataLoading(false);
        };

        if (historyRange.start && historyRange.end && new Date(historyRange.start) <= new Date(historyRange.end)) {
            fetchTasksForRange();
        } else {
            setTasksInRange([]);
        }
    }, [historyRange]);

    const completedInRange = tasksInRange.filter(t => t.completed_at);
    const incompleteInRange = tasksInRange.filter(t => !t.completed_at);

    const handleGetInsights = async () => {
        setInsightsState({ ...insightsState, isLoading: true });

        if (tasksInRange.length === 0) {
            setInsightsState({ content: "No task data found for the selected date range. Complete some tasks first!", isLoading: false });
            return;
        }

        const completedData = completedInRange.map(t => {
            let taskString = `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms}) on ${t.due_date}`;
            if (allowCommentAccess && t.comments && t.comments.length > 0) {
                taskString += `\n  - Comments: ${t.comments.join('; ')}`;
            }
            return taskString;
        }).join('\n');
        
        const incompleteData = incompleteInRange.map(t => {
            let taskString = `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms}) on ${t.due_date}`;
             if (allowCommentAccess && t.comments && t.comments.length > 0) {
                taskString += `\n  - Comments: ${t.comments.join('; ')}`;
            }
            return taskString;
        }).join('\n');

        const prompt = `
            Act as a helpful and encouraging productivity coach. Analyze my data for the period from ${historyRange.start} to ${historyRange.end} in the context of my long-term goals.
            ${allowCommentAccess ? "You also have access to my personal comments on each task, which may contain reflections on my progress or blockers." : ""}

            My Core Goals (for long-term motivation):
            ${goals.map(g => `- ${g.text}`).join('\n') || "None"}

            My Current Projects (with deadlines):
            ${projects.filter(p => !p.completed_at && p.deadline).map(p => `- "${p.name}" (Deadline: ${p.deadline})`).join('\n') || "None"}

            My Current Targets (with deadlines):
            ${targets.filter(t => !t.completed_at).map(t => `- "${t.text}" (Deadline: ${t.deadline})`).join('\n') || "None"}

            My Completed Tasks in this period:
            ${completedData || "None"}

            My Incomplete Tasks in this period:
            ${incompleteData || "None"}

            Based on ALL of this data, provide:
            1. **A brief, positive summary** of my productivity, connecting it to my larger goals.
            2. **Actionable Insights:** How did my work in this period contribute to my projects or targets? Are there any misalignments? If comments were provided, use them to identify any underlying themes (e.g., consistent blockers, feelings of being overwhelmed).
            3. **One specific suggestion** for me to improve alignment with my goals going forward.

            Format the response in simple Markdown. Keep it concise and strategic.
        `;

        const result = await generateContent(prompt);
        setInsightsState({ content: formatAIResponse(result), isLoading: false });
    };
    
    const handleGetMentorAdvice = async (userPrompt = '') => {
        setMentorState({ ...mentorState, isLoading: true });

        if (tasksInRange.length === 0 && !userPrompt) {
            setMentorState({ content: "No task data to analyze. Please complete some tasks or ask a general question.", isLoading: false });
            return;
        }

        const completedData = completedInRange.map(t => {
            let taskString = `- "${t.text}" on ${t.due_date}`;
            if (allowCommentAccess && t.comments && t.comments.length > 0) {
                taskString += `\n  - Comments: ${t.comments.join('; ')}`;
            }
            return taskString;
        }).join('\n');

        const incompleteData = incompleteInRange.map(t => {
            let taskString = `- "${t.text}" on ${t.due_date}`;
            if (allowCommentAccess && t.comments && t.comments.length > 0) {
                taskString += `\n  - Comments: ${t.comments.join('; ')}`;
            }
            return taskString;
        }).join('\n');


        const prompt = `
            You are an insightful and supportive study mentor reviewing my Pomodoro timer data for the period from ${historyRange.start} to ${historyRange.end}.
            You have access to my long-term goals and specific targets to provide better context for your advice.
            ${allowCommentAccess ? "You also have access to my personal comments on each task. Use these to understand my mindset, challenges, and successes more deeply." : ""}

            My Core Goals (for long-term motivation):
            ${goals.map(g => `- ${g.text}`).join('\n') || "None"}

            My Current Projects (with deadlines):
            ${projects.filter(p => !p.completed_at && p.deadline).map(p => `- "${p.name}" (Deadline: ${p.deadline})`).join('\n') || "None"}

            My Current Targets (with deadlines):
            ${targets.filter(t => !t.completed_at).map(t => `- "${t.text}" (Deadline: ${t.deadline})`).join('\n') || "None"}

            My Completed Tasks in this period:
            ${completedData || "None"}

            My Incomplete Tasks in this period:
            ${incompleteData || "None"}

            ${userPrompt ? `My specific question is: "${userPrompt}"\n` : ''}

            Based on all of this information:
            1. **Connect my work in this period to my bigger goals.** Am I making progress on what matters most?
            2. **Assess my consistency and focus** in light of my targets and project deadlines. If available, use my comments to add nuance to this assessment (e.g., "I see you completed the task, but your comments suggest you found it very difficult. Let's talk about that.").
            3. **Provide specific, actionable advice** like a mentor. If themes emerge (e.g., procrastination on a specific project, or comments showing a lack of confidence), address them. Suggest related content (videos, articles) using your search knowledge if relevant.
            4. ${userPrompt ? 'Address my specific question directly, using the context provided.' : 'Focus on general patterns and alignment with my goals.'}
            
            Keep the tone supportive and strategic. Format using simple Markdown.
        `;

        const result = await generateContent(prompt);
        setMentorState({ content: formatAIResponse(result), isLoading: false });
    };
    
    const renderDataSummary = () => {
        if (isDataLoading) {
            return <div className="h-24"><Spinner /></div>;
        }
        if (tasksInRange.length === 0) {
            return <p className="text-center text-white/60 py-4">No task data in this date range.</p>
        }

        const completionPercentage = tasksInRange.length > 0
            ? Math.round((completedInRange.length / tasksInRange.length) * 100)
            : 0;

        return (
            <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
                    <div>
                        <div className="text-sm text-white/70">Total Tasks</div>
                        <div className="text-2xl font-bold text-white">{tasksInRange.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-white/70">Completed</div>
                        <div className="text-2xl font-bold text-green-400">{completedInRange.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-white/70">Incomplete</div>
                        <div className="text-2xl font-bold text-red-400">{incompleteInRange.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-white/70">Completion %</div>
                        <div className="text-2xl font-bold text-cyan-400">{completionPercentage}%</div>
                    </div>
                </div>
                <button 
                    onClick={() => setIsTaskListVisible(!isTaskListVisible)}
                    className="text-center w-full text-sm text-cyan-300 hover:text-cyan-200 mb-2 py-1"
                >
                    {isTaskListVisible ? '▼ Hide Task List' : '► Show Task List'}
                </button>
                {isTaskListVisible && (
                    <div className="max-h-48 overflow-y-auto bg-black/20 p-2 rounded-lg text-sm">
                        <ul className="space-y-1">
                            {tasksInRange.sort((a,b) => a.due_date.localeCompare(b.due_date)).map(task => (
                                <li key={task.id} className={`p-1 flex items-center gap-2 ${task.completed_at ? 'text-green-300/90' : 'text-red-300/90'}`}>
                                    <span className="font-mono text-xs">{task.due_date}</span>
                                    <span>{task.text}</span>
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${task.completed_at ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                      {task.completed_at ? 'Done' : 'Pending'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };


    return (
        <>
            <Panel title="Select Data Range">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <span className="text-white">to</span>
                    <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
            </Panel>

            <Panel title="📊 Data for Analysis">
                {renderDataSummary()}
            </Panel>
            
            <Panel title="⚙️ AI Settings">
                <div className="flex items-center justify-center gap-3 bg-black/20 p-3 rounded-lg">
                    <label htmlFor="comment-access" className="text-white/80 text-sm cursor-pointer">
                        Allow AI to analyze task comments for deeper insights
                    </label>
                    <input
                        id="comment-access"
                        type="checkbox"
                        checked={allowCommentAccess}
                        onChange={(e) => setAllowCommentAccess(e.target.checked)}
                        className="h-5 w-5 rounded bg-white/20 border-white/30 text-purple-400 focus:ring-purple-400 cursor-pointer"
                    />
                </div>
                 <p className="text-xs text-white/60 text-center mt-2">
                    This can provide more personalized advice by analyzing themes, blockers, or feelings in your comments. Disabled by default for your privacy.
                </p>
            </Panel>

            <AIPanel 
                title="🤖 AI Study Insights"
                description="Get AI-powered insights on your study habits based on your selected performance."
                buttonText="Get Insights"
                onGetAdvice={handleGetInsights}
                aiState={insightsState}
                showPromptTextarea={false}
            />
             <AIPanel 
                title="🎓 AI Study Mentor"
                description="Your AI mentor analyzes your progress, goals, and targets to offer personalized advice."
                buttonText="Get Mentorship Advice"
                onGetAdvice={handleGetMentorAdvice}
                aiState={mentorState}
                showPromptTextarea={true}
            />
        </>
    );
};

export default AICoachPage;
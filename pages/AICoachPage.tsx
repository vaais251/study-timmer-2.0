

import React, { useState, useMemo } from 'react';
import { Task, Goal, Target, Project } from '../types';
import { getTodayDateString } from '../utils/date';
import { generateContent } from '../services/geminiService';
import AIPanel from '../components/AIPanel';

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
    completedTasks: Task[];
    incompleteTasks: Task[];
    goals: Goal[];
    targets: Target[];
    projects: Project[];
}

const AICoachPage: React.FC<AICoachPageProps> = ({ completedTasks, incompleteTasks, goals, targets, projects }) => {
    const [insightsState, setInsightsState] = useState({ content: "Get AI-powered insights on your study habits based on today's performance.", isLoading: false });
    const [mentorState, setMentorState] = useState({ content: "Get personalized advice, content suggestions, and consistency tips.", isLoading: false });

    const todaysTasks = useMemo(() => {
        const todayString = getTodayDateString();
        const completedToday = completedTasks.filter(t => t.due_date === todayString);
        const incompleteToday = incompleteTasks.filter(t => t.due_date === todayString);
        return { completedToday, incompleteToday };
    }, [completedTasks, incompleteTasks]);


    const handleGetInsights = async () => {
        setInsightsState({ ...insightsState, isLoading: true });
        
        const { completedToday, incompleteToday } = todaysTasks;
        const todayStr = getTodayDateString();

        if (completedToday.length === 0 && incompleteToday.length === 0) {
            setInsightsState({ content: "Not enough data today to generate insights. Complete some tasks first!", isLoading: false });
            return;
        }

        const completedData = completedToday.map(t => `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms})`).join('\n');
        const incompleteData = incompleteToday.map(t => `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms})`).join('\n');

        const prompt = `
            Act as a helpful and encouraging productivity coach. Analyze my data for today (${todayStr}) in the context of my long-term goals.

            My Core Goals (for long-term motivation):
            ${goals.map(g => `- ${g.text}`).join('\n') || "None"}

            My Current Projects (with deadlines):
            ${projects.filter(p => !p.completed_at && p.deadline).map(p => `- "${p.name}" (Deadline: ${p.deadline})`).join('\n') || "None"}

            My Current Targets (with deadlines):
            ${targets.filter(t => !t.completed_at).map(t => `- "${t.text}" (Deadline: ${t.deadline})`).join('\n') || "None"}

            My Completed Tasks Today:
            ${completedData || "None"}

            My Incomplete Tasks Today:
            ${incompleteData || "None"}

            Based on ALL of this data, provide:
            1. **A brief, positive summary** of my productivity, connecting it to my larger goals.
            2. **Actionable Insights:** How did today's work contribute to my projects or targets? Are there any misalignments?
            3. **One specific suggestion** for me to improve alignment with my goals tomorrow.

            Format the response in simple Markdown. Keep it concise and strategic.
        `;

        const result = await generateContent(prompt);
        setInsightsState({ content: formatAIResponse(result), isLoading: false });
    };
    
    const handleGetMentorAdvice = async (userPrompt = '') => {
        setMentorState({ ...mentorState, isLoading: true });
        const { completedToday, incompleteToday } = todaysTasks;
        const todayStr = getTodayDateString();

        const prompt = `
            You are an insightful and supportive study mentor reviewing my Pomodoro timer data for today, ${todayStr}.
            You have access to my long-term goals and specific targets to provide better context for your advice.

            My Core Goals (for long-term motivation):
            ${goals.map(g => `- ${g.text}`).join('\n') || "None"}

            My Current Projects (with deadlines):
            ${projects.filter(p => !p.completed_at && p.deadline).map(p => `- "${p.name}" (Deadline: ${p.deadline})`).join('\n') || "None"}

            My Current Targets (with deadlines):
            ${targets.filter(t => !t.completed_at).map(t => `- "${t.text}" (Deadline: ${t.deadline})`).join('\n') || "None"}

            My Completed Tasks Today:
            ${completedToday.map(t => `- "${t.text}"`).join('\n') || "None"}

            My Incomplete Tasks Today:
            ${incompleteToday.map(t => `- "${t.text}"`).join('\n') || "None"}

            ${userPrompt ? `My specific question is: "${userPrompt}"\n` : ''}

            Based on all of this information:
            1. **Connect today's work to my bigger goals.** Am I making progress on what matters most?
            2. **Assess my consistency and focus** for the day in light of my targets and project deadlines.
            3. **Provide specific, actionable advice** like a mentor. If themes emerge (e.g., procrastination on a specific project), address them. Suggest related content (videos, articles) using your search knowledge if relevant.
            4. ${userPrompt ? 'Address my specific question directly, using the context provided.' : 'Focus on general patterns and alignment with my goals.'}
            
            Keep the tone supportive and strategic. Format using simple Markdown.
        `;

        const result = await generateContent(prompt);
        setMentorState({ content: formatAIResponse(result), isLoading: false });
    };


    return (
        <>
            <AIPanel 
                title="🤖 AI Study Insights"
                description="Get AI-powered insights on your study habits based on today's performance."
                buttonText="Get Today's Insights"
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
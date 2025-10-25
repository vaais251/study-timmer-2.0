

import React, { useState, useMemo } from 'react';
import { Task } from '../types';
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
}

const AICoachPage: React.FC<AICoachPageProps> = ({ completedTasks, incompleteTasks }) => {
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

        let completedData = completedToday.map(t => `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms})`).join('\n');
        let incompleteData = incompleteToday.map(t => `- Task: "${t.text}" (Est: ${t.total_poms}, Done: ${t.completed_poms})`).join('\n');

        const prompt = `
            Act as a helpful and encouraging productivity coach. Analyze my data for today (${todayStr}).

            My Completed Tasks Today:
            ${completedData || "None"}

            My Incomplete Tasks Today:
            ${incompleteData || "None"}

            Based on this data, provide:
            1. **A brief, positive summary** of my productivity.
            2. **Actionable Insights:** Any noticeable patterns?
            3. **One specific suggestion** for me to improve.

            Format the response in simple Markdown. Keep it concise.
        `;

        const result = await generateContent(prompt);
        setInsightsState({ content: formatAIResponse(result), isLoading: false });
    };
    
    const handleGetMentorAdvice = async (userPrompt = '') => {
        setMentorState({ ...mentorState, isLoading: true });
        const { completedToday, incompleteToday } = todaysTasks;
        const todayStr = getTodayDateString();

        if (completedToday.length === 0 && incompleteToday.length === 0) {
            setMentorState({ content: "Not enough data today for mentorship. Complete some tasks first!", isLoading: false });
            return;
        }

        const prompt = `
            You are an insightful and supportive study mentor reviewing my Pomodoro timer data for today, ${todayStr}.
            Analyze my study patterns.

            My Completed Tasks:
            ${completedToday.map(t => `- "${t.text}"`).join('\n') || "None"}

            My Incomplete Tasks:
            ${incompleteToday.map(t => `- "${t.text}"`).join('\n') || "None"}

            ${userPrompt ? `My specific question is: "${userPrompt}"\n` : ''}

            Based on this:
            1. **Identify recurring themes** in my tasks.
            2. **Assess my consistency** for the day.
            3. **Provide specific, actionable advice** like a mentor. If themes emerge, suggest related content (videos, articles) using your search knowledge.
            4. ${userPrompt ? 'Address my specific question.' : 'Focus on general patterns.'}
            
            Keep the tone supportive. Format using simple Markdown.
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
                description="Your AI mentor analyzes your progress to offer personalized advice and content suggestions."
                buttonText="Get Mentorship Advice"
                onGetAdvice={handleGetMentorAdvice}
                aiState={mentorState}
                showPromptTextarea={true}
            />
        </>
    );
};

export default AICoachPage;

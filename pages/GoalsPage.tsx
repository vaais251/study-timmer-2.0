
import React, { useState, useMemo } from 'react';
import { Goal, Target, Project } from '../types';
import Panel from '../components/common/Panel';
import { TrashIcon } from '../components/common/Icons';

interface GoalsPageProps {
    goals: Goal[];
    targets: Target[];
    projects: Project[];
    onAddGoal: (text: string) => void;
    onDeleteGoal: (id: string) => void;
    onAddTarget: (text: string, deadline: string) => void;
    onUpdateTarget: (id: string, completed: boolean) => void;
    onDeleteTarget: (id: string) => void;
    onAddProject: (name: string, deadline: string | null) => Promise<string | null>;
    onUpdateProject: (id: string, completed: boolean) => void;
    onDeleteProject: (id: string) => void;
}

const GoalsPage: React.FC<GoalsPageProps> = ({ goals, targets, projects, onAddGoal, onDeleteGoal, onAddTarget, onUpdateTarget, onDeleteTarget, onAddProject, onUpdateProject, onDeleteProject }) => {
    const [newGoal, setNewGoal] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newProjectDeadline, setNewProjectDeadline] = useState('');

    const upcomingDeadlines = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];

        const projectsDue = projects.filter(p => !p.completed_at && p.deadline === tomorrowString);
        const targetsDue = targets.filter(t => !t.completed_at && t.deadline === tomorrowString);

        return [...projectsDue, ...targetsDue];
    }, [projects, targets]);


    const handleAddGoal = () => {
        if (newGoal.trim()) {
            onAddGoal(newGoal.trim());
            setNewGoal('');
        }
    };

    const handleAddTarget = () => {
        if (newTarget.trim() && newDeadline) {
            onAddTarget(newTarget.trim(), newDeadline);
            setNewTarget('');
            setNewDeadline('');
        }
    };

    const handleAddNewProject = () => {
        if (newProject.trim()) {
            onAddProject(newProject.trim(), newProjectDeadline || null);
            setNewProject('');
            setNewProjectDeadline('');
        }
    }

    const { activeProjects, completedProjects } = useMemo(() => ({
        activeProjects: projects.filter(p => !p.completed_at),
        completedProjects: projects.filter(p => p.completed_at),
    }), [projects]);

    const sortedTargets = [...targets].sort((a, b) => {
        if (a.completed_at && !b.completed_at) return 1;
        if (!a.completed_at && b.completed_at) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    return (
        <div>
            {upcomingDeadlines.length > 0 && (
                <div className="bg-amber-500/30 border border-amber-500 text-amber-200 p-4 rounded-2xl mb-4 animate-pulse-slow">
                    <h3 className="font-bold text-lg text-center mb-2">🔥 Heads Up! Due Tomorrow:</h3>
                    <ul className="list-disc list-inside text-sm text-center">
                        {upcomingDeadlines.map(item => (
                            <li key={item.id}>{'name' in item ? `Project: ${item.name}` : `Target: ${item.text}`}</li>
                        ))}
                    </ul>
                </div>
            )}

            <Panel title="📂 Project Status">
                <p className="text-white/80 text-center text-sm mb-4">A high-level overview of all your ongoing and completed projects.</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                        placeholder="Add a new project..."
                        className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                    <input
                        type="date"
                        value={newProjectDeadline}
                        onChange={(e) => setNewProjectDeadline(e.target.value)}
                        className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full sm:w-auto text-center"
                        style={{colorScheme: 'dark'}}
                        title="Optional deadline"
                    />
                    <button onClick={handleAddNewProject} className="p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-purple-500 to-indigo-600">Add Project</button>
                </div>
                 <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    <h3 className="text-white font-bold text-md">Active Projects</h3>
                    {activeProjects.map(project => (
                        <div key={project.id} className="flex items-center bg-white/10 p-3 rounded-lg">
                            <input type="checkbox" checked={false} onChange={(e) => onUpdateProject(project.id, e.target.checked)} className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 mr-3 flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <span className="text-white">{project.name}</span>
                                {project.deadline && (
                                    <span className="block text-xs text-amber-300/80 mt-1">
                                        Due: {new Date(project.deadline + 'T00:00:00').toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                             <button onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${project.name}"? This will unlink it from all tasks.`)) {
                                    onDeleteProject(project.id)
                                }
                            }} className="p-1 text-red-400 hover:text-red-300 transition" title="Delete Project"><TrashIcon /></button>
                        </div>
                    ))}
                    {activeProjects.length === 0 && <p className="text-center text-sm text-white/60 py-2">No active projects.</p>}
                    
                    {completedProjects.length > 0 && <h3 className="text-white font-bold text-md pt-2">Completed Projects</h3>}
                    {completedProjects.map(project => (
                         <div key={project.id} className="flex items-center bg-white/5 p-3 rounded-lg text-white/60">
                            <input type="checkbox" checked={true} onChange={(e) => onUpdateProject(project.id, e.target.checked)} className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 mr-3" />
                            <span className="line-through">{project.name}</span>
                        </div>
                    ))}
                </div>
            </Panel>
            
            <Panel title="🎯 My Core Goals">
                <p className="text-white/80 text-center text-sm mb-4">Your long-term affirmations. Review these daily to stay motivated.</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
                        placeholder="e.g., Achieve a 4.0 GPA"
                        className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                    <button onClick={handleAddGoal} className="p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-green-500 to-emerald-600">Add Goal</button>
                </div>
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {goals.map(goal => (
                        <li key={goal.id} className="flex items-center justify-between bg-white/10 p-3 rounded-lg">
                            <span className="text-white">{goal.text}</span>
                            <button onClick={() => onDeleteGoal(goal.id)} className="text-red-400 hover:text-red-300 text-2xl font-bold leading-none p-1 transition">&times;</button>
                        </li>
                    ))}
                    {goals.length === 0 && <p className="text-center text-white/60 p-4">No core goals defined yet.</p>}
                </ul>
            </Panel>

            <Panel title="🏁 Key Targets">
                 <p className="text-white/80 text-center text-sm mb-4">Specific, measurable objectives with a deadline.</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        placeholder="e.g., Finish history essay draft"
                        className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                    <input
                        type="date"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full sm:w-auto text-center"
                        style={{colorScheme: 'dark'}}
                    />
                    <button onClick={handleAddTarget} className="p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Add Target</button>
                </div>
                 <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {sortedTargets.map(target => (
                        <li key={target.id} className={`flex items-center justify-between p-3 rounded-lg transition-all ${target.completed_at ? 'bg-white/5 text-white/50' : 'bg-white/10'}`}>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={!!target.completed_at} onChange={(e) => onUpdateTarget(target.id, e.target.checked)} className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400" />
                                <span className={target.completed_at ? 'line-through' : ''}>{target.text}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-black/20 px-2 py-1 rounded-full">{new Date(target.deadline + 'T00:00:00').toLocaleDateString()}</span>
                                <button onClick={() => onDeleteTarget(target.id)} className="text-red-400 hover:text-red-300 text-2xl font-bold leading-none p-1 transition">&times;</button>
                            </div>
                        </li>
                    ))}
                    {targets.length === 0 && <p className="text-center text-white/60 p-4">No key targets defined yet.</p>}
                </ul>
            </Panel>
             <style>{`
              @keyframes pulse-slow {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.02); opacity: 0.95; }
              }
              .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default GoalsPage;

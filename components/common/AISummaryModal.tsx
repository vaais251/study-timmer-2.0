import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './Spinner';

// Helper to format AI response from Markdown to HTML
function formatAIResponse(text: string): string {
    // A more robust markdown-to-HTML conversion
    let html = text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-md font-bold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>');

    // Unordered lists
    html = html.replace(/^\s*[-*] (.*$)/gim, '<li>$1</li>');
    html = html.replace(/<\/li>\s*<li>/g, '</li><li>'); // Join adjacent list items
    html = html.replace(/(<li>.*?<\/li>)/gs, (match) => `<ul class="list-disc list-inside ml-4 my-2">${match}</ul>`);
    html = html.replace(/<\/ul>\s*<ul class="list-disc list-inside ml-4 my-2">/g, ''); // Join adjacent lists

    // Numbered lists
    html = html.replace(/^\s*\d+\.\s(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)/gs, (match, p1) => {
        // Check if it's already in a UL, if so, don't wrap it in OL. This is a simplification.
        if (p1.includes('<ul')) return p1;
        return `<ol class="list-decimal list-inside ml-4 my-2">${p1}</ol>`;
    });
    html = html.replace(/<\/ol>\s*<ol class="list-decimal list-inside ml-4 my-2">/g, ''); // Join adjacent lists

    // Paragraphs (from newlines)
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');
    // Remove <br/> inside list constructs, which is a common side effect
    html = html.replace(/<ul(.*?)><br\/>/g, '<ul$1>');
    html = html.replace(/<ol(.*?)><br\/>/g, '<ol$1>');
    html = html.replace(/<br\/><\/li>/g, '</li>');

    return html;
}

interface AISummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    fetcher: () => Promise<string>;
}

const AISummaryModal: React.FC<AISummaryModalProps> = ({ isOpen, onClose, title, fetcher }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setIsLoading(true);
            setSummary('');
            fetcher()
                .then(result => setSummary(formatAIResponse(result)))
                .catch(err => setSummary('<p class="text-red-400">Sorry, an error occurred. Please try again.</p>'))
                .finally(() => setIsLoading(false));
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, fetcher]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-2xl w-11/12 shadow-2xl animate-slideUp max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto pr-4 -mr-4 flex-grow">
                    {isLoading ? (
                        <div className="flex flex-col justify-center items-center h-48 text-white/80">
                            <Spinner />
                            <p className="mt-4 animate-pulse">Gemini is analyzing your data...</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/50 p-4 rounded-lg text-white/90 text-sm text-left leading-relaxed animate-fadeIn prose prose-sm prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: summary }}
                        />
                    )}
                </div>
            </div>
             <style>{`
                .prose-invert ul { margin-top: 0.5em; margin-bottom: 0.5em; }
                .prose-invert li { margin-top: 0.2em; margin-bottom: 0.2em; }
                .prose-invert strong { color: #a7f3d0; } /* teal-200 */
                .prose-invert h2, .prose-invert h3 { color: #e2e8f0; } /* slate-200 */
            `}</style>
        </div>
    );
    
    return createPortal(modalContent, document.body);
};

export default AISummaryModal;

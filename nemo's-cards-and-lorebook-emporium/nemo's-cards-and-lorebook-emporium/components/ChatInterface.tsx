import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

interface ChatInterfaceProps {
    history: ChatMessage[];
    onSendMessage: (message: string) => void;
    isAiResponding: boolean;
    suggestions: string[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, onSendMessage, isAiResponding, suggestions }) => {
    const [message, setMessage] = useState('');
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    useEffect(() => {
        setSelectedSuggestions(new Set());
    }, [suggestions]);

    const sendMessage = () => {
        if (message.trim() && !isAiResponding) {
            onSendMessage(message);
            setMessage('');
        }
    };

    const useSelectedSuggestions = () => {
        if (selectedSuggestions.size > 0 && !isAiResponding) {
            const combinedMessage = Array.from(selectedSuggestions).join('\n');
            onSendMessage(combinedMessage);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        if (!isAiResponding) {
            setSelectedSuggestions(prev => {
                const newSet = new Set(prev);
                if (newSet.has(suggestion)) {
                    newSet.delete(suggestion);
                } else {
                    newSet.add(suggestion);
                }
                return newSet;
            });
        }
    };


    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 h-full">
            <div className="h-full flex flex-col">
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {history.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl px-4 py-2 rounded-lg shadow-md ${msg.sender === 'user' ? 'bg-leather text-parchment' : 'bg-parchment-dark text-sepia-dark'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isAiResponding && history[history.length -1]?.sender === 'user' && (
                         <div className="flex justify-start">
                            <div className="max-w-xl px-4 py-2 rounded-lg bg-parchment-dark text-sepia-dark">
                               <LoadingSpinner />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-leather/20 bg-parchment-dark/50 rounded-b-lg">
                    {suggestions.length > 0 && !isAiResponding && (
                        <div className="mb-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSuggestionClick(s)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                            selectedSuggestions.has(s)
                                            ? 'bg-leather text-parchment ring-2 ring-leather/70'
                                            : 'bg-sepia-light/50 text-sepia-dark hover:bg-sepia-light/80'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {selectedSuggestions.size > 0 && (
                                <Button onClick={useSelectedSuggestions} variant="secondary" className="w-full text-sm py-2">
                                    Use Selected Suggestion(s)
                                </Button>
                            )}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex items-start gap-2">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            placeholder="Type your ideas here. Press Ctrl+Enter to send..."
                            className="flex-grow p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather rounded-md text-sepia-dark disabled:opacity-60 resize-y max-h-40"
                            disabled={isAiResponding}
                        />
                        <Button type="submit" isLoading={isAiResponding} disabled={!message.trim()}>
                            Send
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
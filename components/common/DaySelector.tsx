import React from 'react';

interface DaySelectorProps {
    selectedDays: number[];
    onDayToggle: (dayIndex: number) => void;
}

const DaySelector: React.FC<DaySelectorProps> = ({ selectedDays, onDayToggle }) => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
        <div className="flex justify-center gap-1.5">
            {days.map((day, index) => {
                const isSelected = selectedDays.includes(index);
                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => onDayToggle(index)}
                        className={`w-9 h-9 rounded-full text-xs font-bold transition-all transform hover:scale-110 ${
                            isSelected ? 'bg-cyan-500 text-white shadow-md' : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                        }`}
                        title={`Toggle ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}`}
                    >
                        {day}
                    </button>
                );
            })}
        </div>
    );
};

export default DaySelector;

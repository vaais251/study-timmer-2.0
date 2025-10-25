
import React from 'react';

const Spinner: React.FC = () => {
    return (
        <div className="flex justify-center items-center h-full">
            <div className="w-12 h-12 border-4 border-white/20 border-t-purple-400 rounded-full animate-spin"></div>
        </div>
    );
};

export default Spinner;

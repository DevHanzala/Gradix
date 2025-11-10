import React from "react";

const Recommendations = ({ recommendations }) => {
  return (
    <div className="mt-2">
      <ul className="list-disc pl-5">
        {recommendations.weak_areas.map((area, index) => (
          <li key={index} className="text-sm text-gray-700 mb-2">
            <strong>{area.topic}</strong> (Performance: {area.performance}%)  
            <p className="text-gray-600">Suggestion: {area.suggestion}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Recommendations;
"use client";

export function LikertField({ question, value, onChange }) {
  return (
    <article className="question-card">
      <label className="question-label">{question.label}</label>
      <div className="likert-row">
        {[1, 2, 3, 4, 5].map((option) => (
          <label className="likert-chip" key={option}>
            <input
              type="radio"
              name={question.id}
              value={option}
              checked={value === option}
              onChange={() => onChange(question.id, option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <div className="likert-caption">
        <span>Low</span>
        <span>High</span>
      </div>
    </article>
  );
}

export function TextField({ question, value, onChange }) {
  return (
    <article className="question-card full-span">
      <label className="question-label" htmlFor={question.id}>
        {question.label}
      </label>
      <textarea
        id={question.id}
        className="textarea"
        rows={5}
        value={value}
        placeholder={question.placeholder}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    </article>
  );
}

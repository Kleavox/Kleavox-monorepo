import { fieldText, statusSentence, type StatusLineModel } from "./status-line";

export function StatusLine({ model }: { model: StatusLineModel }) {
  return (
    <h1 className="kvx-status-line" aria-label={statusSentence(model)}>
      <span className="kvx-status-line-tool" aria-hidden="true">
        {model.tool}
      </span>
      {model.fields.map((field, index) => (
        <span
          key={`${field.label}-${index}`}
          className={
            field.attention
              ? "kvx-status-line-field is-attention"
              : "kvx-status-line-field"
          }
          aria-hidden="true"
        >
          {index > 0 ? <span className="kvx-status-line-sep">·</span> : null}
          {fieldText(field)}
        </span>
      ))}
    </h1>
  );
}

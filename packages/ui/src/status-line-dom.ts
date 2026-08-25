import { fieldText, statusSentence, type StatusLineModel } from "./status-line";

export function renderStatusLine(
  target: HTMLElement,
  model: StatusLineModel,
): void {
  target.className = "kvx-status-line";
  target.setAttribute("aria-label", statusSentence(model));
  target.replaceChildren();

  const tool = document.createElement("span");
  tool.className = "kvx-status-line-tool";
  tool.setAttribute("aria-hidden", "true");
  tool.textContent = model.tool;
  target.append(tool);

  model.fields.forEach((field, index) => {
    const wrapper = document.createElement("span");
    wrapper.className = field.attention
      ? "kvx-status-line-field is-attention"
      : "kvx-status-line-field";
    wrapper.setAttribute("aria-hidden", "true");
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "kvx-status-line-sep";
      separator.textContent = "·";
      wrapper.append(separator);
    }
    wrapper.append(fieldText(field));
    target.append(wrapper);
  });
}

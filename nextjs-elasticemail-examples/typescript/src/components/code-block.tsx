interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language = "typescript", title }: CodeBlockProps) {
  return (
    <div className="code-block">
      {title && (
        <div className="code-block-title">
          <span>{title}</span>
          <span className="muted">{language}</span>
        </div>
      )}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

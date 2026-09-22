interface ResultDisplayProps {
  data?: unknown;
  error?: string | null;
  loading?: boolean;
  title?: string;
}

export function ResultDisplay({ data, error, loading, title = "Result" }: ResultDisplayProps) {
  if (loading) {
    return (
      <div className="result result-loading">
        <p className="muted">Working...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result result-error">
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (data) {
    return (
      <div className="result result-success">
        <h3>{title}</h3>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  return null;
}

export interface ApiResult {
  error?: string;
  success?: boolean;
  [key: string]: unknown;
}

interface ResultDisplayProps {
  data?: ApiResult | null;
  loading?: boolean;
  title?: string;
}

export function ResultDisplay({ data, loading, title = "Result" }: ResultDisplayProps) {
  if (loading) {
    return (
      <div className="result">
        <p className="muted">Working...</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.error) {
    return (
      <div className="result result-error">
        <h3>Error</h3>
        <p>{data.error}</p>
      </div>
    );
  }

  return (
    <div className="result result-success">
      <h3>{title}</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

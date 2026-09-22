import { Link } from "@redwoodjs/router";

interface PageHeaderProps {
  title: string;
  description: string;
  sourcePath?: string;
}

export function PageHeader({ title, description, sourcePath }: PageHeaderProps) {
  return (
    <div className="page-header">
      <Link to="/" className="muted">
        &larr; Back to examples
      </Link>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {sourcePath && (
        <a
          href={`https://github.com/ElasticEmail/elasticemail-examples/blob/main/redwoodjs-elasticemail-examples/typescript/${sourcePath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="muted"
        >
          View source &rarr;
        </a>
      )}
    </div>
  );
}

import Link from "next/link";

export function PageHeader({ title, description, sourcePath }) {
  return (
    <div className="page-header">
      <Link href="/" className="muted">
        &larr; Back to examples
      </Link>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {sourcePath && (
        <a
          href={`https://github.com/ElasticEmail/elasticemail-examples/blob/main/nextjs-elasticemail-examples/javascript/${sourcePath}`}
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

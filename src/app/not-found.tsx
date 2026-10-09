import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="public-main">
      <section className="public-card not-found-card">
        <span className="eyebrow">WAYPOINT / DEMO</span>
        <h1>This path doesn’t lead anywhere.</h1>
        <p className="fictional-note">Return to the fictional workspace to keep exploring.</p>
        <Link href="/" className="button">
          Back to workspace
        </Link>
      </section>
    </main>
  )
}

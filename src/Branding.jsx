import BuyMeCoffeeButton from './BuyMeCoffee'
import logoUrl from './favicon.svg'
import './Branding.css'

const SITE_HOME = '/'
const CONTACT_EMAIL = 'hello@alexmoorephysics.com'

// The awm Physics logo, linking back to the gallery of simulations.
export function BrandLogo({ className = '' }) {
  return (
    <a
      className={`awm-logo-link ${className}`.trim()}
      href={SITE_HOME}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="See other simulations at alexmoorephysics.com"
      title="See other simulations"
    >
      <img src={logoUrl} alt="" />
    </a>
  )
}

// One row of support links: more simulations, contact email, Buy me a coffee.
// Sits inside an existing footer row, or on its own at the bottom of the landing page.
export function SupportLinks({ className = '' }) {
  return (
    <div className={`awm-support ${className}`.trim()}>
      <a className="awm-more-sims" href={SITE_HOME} target="_blank" rel="noopener noreferrer">
        <img src={logoUrl} alt="" />
        <span>See other simulations</span>
      </a>
      <a className="awm-contact" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      <BuyMeCoffeeButton />
    </div>
  )
}

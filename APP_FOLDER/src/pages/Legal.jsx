import { Link } from 'react-router-dom';

function PolicyHead({ eyebrow, title, intro }) {
  return (
    <header className="policy-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{intro}</p>
    </header>
  );
}

export function Terms() {
  return (
    <main className="wrap policy-page">
      <PolicyHead
        eyebrow="Using the service"
        title="Terms of Use"
        intro="These terms apply when you browse BUhostels or create and manage an owner account."
      />
      <article className="policy-content">
        <nav className="policy-nav" aria-label="Related information">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/documentation">How BUhostels works</Link>
        </nav>
        <p className="policy-updated">Effective and last updated: 17 October 2026.</p>

        <h2>1. About BUhostels</h2>
        <p>
          BUhostels is a listing and discovery service intended to help Busitema University students find hostels and
          contact listing owners directly. It is not a landlord, letting agent, booking service, payment processor, or
          party to any accommodation agreement.
        </p>

        <h2>2. Accounts and approval</h2>
        <p>
          You must provide accurate account information and keep your password secure. Owner accounts are subject to
          administrator review. Registration alone does not authorize you to publish listings; an administrator must
          approve your account. You are responsible for activity carried out through your account and should promptly
          report suspected unauthorized access to the site administrator.
        </p>

        <h2>3. Owner listing responsibilities</h2>
        <p>
          If you publish a listing, you confirm that you are authorized to provide the information and photos and that
          the listing is accurate, current, and not misleading. You are responsible for updating prices, availability,
          contact details, and other listing content. Do not upload content that you do not have permission to use, that
          violates another person&apos;s rights, or that is unlawful, abusive, or deceptive.
        </p>
        <p>
          Published listing details, contact information, and uploaded photos may be publicly visible. Only include
          information you are willing to share publicly.
        </p>

        <h2>4. Browsing and contacting owners</h2>
        <p>
          Visitors may use listing information to make enquiries. Visitors and owners are responsible for independently
          verifying accommodation details, availability, identity, prices, payment requests, and any rental agreement.
          Inspect the accommodation and agree on terms directly with the owner before making a payment.
        </p>

        <h2>5. No guarantee or transaction service</h2>
        <p>
          BUhostels does not guarantee listing accuracy, availability, suitability, owner identity, accommodation
          quality, or the outcome of any contact or transaction. No booking or payment is made through BUhostels. To the
          extent allowed by law, the platform is provided on an &ldquo;as available&rdquo; basis.
        </p>

        <h2>6. Moderation and account action</h2>
        <p>
          Administrators may review, hide, or remove listings and may approve, suspend, or delete owner accounts to
          operate the platform, address inaccurate or inappropriate content, or protect users. We may limit or
          discontinue the service when reasonably necessary.
        </p>

        <h2>7. Privacy</h2>
        <p>
          Our <Link to="/privacy">Privacy Policy</Link> explains the information handled by the service. By creating an
          owner account, you confirm that you have read the policy and consent to the processing described there.
        </p>

        <h2>8. Changes and contact</h2>
        <p>
          We may update these terms as the service changes. Continued use after updated terms are published means you
          accept the updated terms where permitted by law. For questions or support, contact the BUhostels site
          administrator through the support contact provided for this service.
        </p>

        <p className="policy-updated">
          Last updated: 17 October 2026. These terms are a project template and should be reviewed for the service&apos;s
          actual operating arrangements and applicable law before launch.
        </p>
      </article>
    </main>
  );
}

export function Privacy() {
  return (
    <main className="wrap policy-page">
      <PolicyHead
        eyebrow="Your information"
        title="Privacy Policy"
        intro="This policy explains how BUhostels handles information when you browse the site or create an owner account."
      />
      <article className="policy-content">
        <nav className="policy-nav" aria-label="Related information">
          <Link to="/terms">Terms of Use</Link>
          <Link to="/documentation">How BUhostels works</Link>
        </nav>
        <p className="policy-updated">Effective and last updated: 17 October 2026.</p>

        <h2>Information we handle</h2>
        <ul>
          <li>
            <strong>Owner account details:</strong> name, email address, phone number, account role and status, and
            authentication information. Passwords are managed by Supabase Authentication and are not stored in the
            BUhostels profile table.
          </li>
          <li>
            <strong>Hostel listing information:</strong> hostel name, description, area and address, contact phone and
            WhatsApp number, room types, prices, availability, amenities, and photos submitted by owners.
          </li>
          <li>
            <strong>Usage events:</strong> visits, hostel views, searches, WhatsApp and call link taps, and account or
            listing actions. A random browser identifier is stored in local storage to estimate unique visitors. Search
            text may be included in the administrator&apos;s activity reports.
          </li>
          <li>
            <strong>Technical information:</strong> requests sent to the service and information handled by the hosting
            provider may be processed to deliver, secure, and troubleshoot the site.
          </li>
        </ul>

        <h2>How we use information</h2>
        <p>
          We use information to create and administer accounts, review owner registrations, publish and manage hostel
          listings, display contact links, provide owner and administrator dashboards, understand site activity, and
          protect and maintain the service.
        </p>

        <h2>What is public</h2>
        <p>
          Published listing details and uploaded listing photos are public. The contact name and phone or WhatsApp
          details shown on a listing may be visible to anyone. Owner email addresses and account credentials are not
          displayed on public listings. Do not include sensitive personal information in listing descriptions or photos.
        </p>

        <h2>Storage and service providers</h2>
        <p>
          BUhostels uses Supabase for authentication, database, and photo storage. Depending on how the project is
          deployed, the application and frontend may also be hosted by providers such as Render or Cloudflare. These
          providers process information as needed to operate their services under their own terms and privacy practices.
        </p>
        <p>
          When you choose to call or message a hostel owner, you leave BUhostels for your phone service or WhatsApp.
          Those services are independent and handle information under their own policies.
        </p>

        <h2>Browser storage and analytics</h2>
        <p>
          The site uses browser local storage to keep an owner&apos;s sign-in session and a random visitor identifier,
          and session storage to avoid counting repeated visits within a browsing session. These identifiers are used
          for the site features and aggregate visitor reporting described above. You can clear browser storage in your
          browser settings; clearing a sign-in session signs you out.
        </p>

        <h2>Retention and account requests</h2>
        <p>
          Account and listing information is kept while an account or listing is active and for as long as needed to
          operate and protect the service. Activity records do not currently have an automatic expiry period and may
          remain in reporting records until the site administrator removes them. Deleting an owner account removes its
          profile and associated hostel records, but may not remove already-created activity records.
        </p>
        <p>
          To request access, correction, or deletion of account information, contact the BUhostels site administrator
          through the support contact provided for this service. Some information may need to be retained for
          operational or legal reasons.
        </p>

        <h2>Security and children</h2>
        <p>
          We use access controls and server-side authentication to protect account and administrative features. No
          internet service can guarantee absolute security. BUhostels is intended for people seeking or listing
          accommodation, not for children to create accounts independently.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as the service changes. The effective date above will be revised when an update is
          published. If a material change affects owner accounts, we may ask owners to review and accept the updated
          terms and policy before continuing to use account features.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions or requests, contact the BUhostels site administrator using the support contact provided
          for this service.
        </p>
        <p className="policy-updated">
          This privacy information describes the current project features and is not legal advice.
        </p>
      </article>
    </main>
  );
}

export function Documentation() {
  return (
    <main className="wrap policy-page">
      <PolicyHead
        eyebrow="BUhostels guide"
        title="How BUhostels works"
        intro="A practical guide to finding a hostel, listing accommodation, and understanding the platform."
      />
      <article className="policy-content">
        <nav className="policy-nav" aria-label="Related information">
          <Link to="/terms">Terms of Use</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
        <h2>For students and visitors</h2>
        <p>
          Browse publicly available hostel listings around Busitema University. Search by name or area, then filter by
          room type, price per semester, gender, distance, and amenities. A listing may show photos, room availability,
          prices, and owner contact details.
        </p>
        <p>
          Use the listing&apos;s WhatsApp or phone link to contact the owner directly. BUhostels helps people discover
          listings; it does not take bookings or payments and is not a party to any rental agreement. Confirm
          availability, inspect the accommodation, and agree on terms with the owner before paying.
        </p>

        <h2>For hostel owners</h2>
        <ol>
          <li>Create an owner account using your name, phone number, email, and password.</li>
          <li>Accept the Terms of Use and acknowledge the Privacy Policy to submit registration.</li>
          <li>Wait for an administrator to approve your account before publishing listings.</li>
          <li>Add hostel details, rooms, semester prices, availability, and photos in your owner dashboard.</li>
          <li>Keep your listing accurate and promptly update prices, photos, and availability.</li>
        </ol>
        <p>
          Owner accounts can view listing activity such as views and contact taps. Listings and their photos may be
          visible to the public while published.
        </p>

        <h2>For administrators</h2>
        <p>
          Administrators review owner accounts, manage listings, and view site activity. Activity reporting includes
          visits, hostel views, searches, and WhatsApp or phone contact taps. The platform uses this information to
          provide dashboards and basic usage analytics.
        </p>

        <h2>Platform and data</h2>
        <p>
          BUhostels is a web application with a plain HTML, CSS, and JavaScript frontend, an Express API, and Supabase
          for authentication, database, and photo storage. It stores account details, hostel listings, rooms, photos,
          and activity events. See the <Link to="/privacy">Privacy Policy</Link> for details about personal information.
        </p>
        <p>Prices are displayed in Ugandan shillings (UGX) per semester. Phone numbers are shown in international format for contact links.</p>

        <h2>Important links</h2>
        <ul>
          <li>
            <Link to="/">Browse hostels</Link>
          </li>
          <li>
            <Link to="/login?tab=register">Create an owner account</Link>
          </li>
          <li>
            <Link to="/terms">Terms of Use</Link>
          </li>
          <li>
            <Link to="/privacy">Privacy Policy</Link>
          </li>
        </ul>
        <p className="policy-updated">Last updated: 17 October 2026.</p>
      </article>
    </main>
  );
}

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "18 February 2026";
const VERSION = "1.0";
const CONTACT_EMAIL = "support@macnutrition.co.uk";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/">
          <Button variant="ghost" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {LAST_UPDATED} &middot; Version {VERSION}
          </p>
        </header>

        <div className="space-y-10 text-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Data Controller</h2>
            <p>
              MacNutrition ("we", "us", "our") is the data controller under the UK General Data
              Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p className="mt-2">
              Contact:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
            <p className="mb-2">We collect the following categories of personal data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Identity data (name, email, login details)</li>
              <li>
                Health &amp; nutrition data (food logs, macros, body metrics, water intake, goals)
              </li>
              <li>Technical data (IP address, browser type, timezone, device type)</li>
              <li>Subscription data (payment status via Stripe)</li>
            </ul>
            <p className="mt-3 text-sm bg-muted px-4 py-3 rounded-lg">
              <strong>Note:</strong> Health data is classified as <em>special category data</em>{" "}
              under UK GDPR and is processed only with your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Legal Basis for Processing</h2>
            <p className="mb-2">We process your personal data under the following legal bases:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Contract</strong> — to provide the services you have signed up for
              </li>
              <li>
                <strong>Consent</strong> — for health data and any marketing communications
              </li>
              <li>
                <strong>Legitimate interests</strong> — for security monitoring and service
                improvement
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide nutrition tracking features</li>
              <li>Calculate personalised calorie and macro values</li>
              <li>Send meal and hydration reminders</li>
              <li>Manage subscriptions and billing</li>
              <li>Improve system performance and AI accuracy</li>
            </ul>
            <p className="mt-3 font-medium">We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Third Parties</h2>
            <p className="mb-2">
              We share limited data with trusted processors only as necessary to operate the
              service:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Stripe</strong> — payment processing
              </li>
              <li>
                <strong>Supabase</strong> — secure database and cloud infrastructure
              </li>
              <li>
                <strong>Email providers</strong> — transactional notifications and reminders
              </li>
              <li>
                <strong>Push notification services</strong> — in-app and device alerts
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              All processors operate under GDPR-compliant data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>
              We retain your data while your account is active. Upon account deletion, all personal
              and health data is permanently removed, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="mb-2">Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Rectify inaccurate or incomplete data</li>
              <li>Request erasure ("right to be forgotten")</li>
              <li>Withdraw consent at any time</li>
              <li>Request data portability</li>
              <li>
                Lodge a complaint with the{" "}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Information Commissioner's Office (ICO)
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Security</h2>
            <p>
              We protect your data using HTTPS encryption, secure cloud hosting with row-level
              access controls, and strict access management. Only you can access your personal
              health data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Account Deletion</h2>
            <p>
              You may delete your account at any time in Settings. Deletion permanently and
              irreversibly removes all your health and personal data from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Policy Updates</h2>
            <p>
              If we make material changes to this policy, we will notify you via email or in-app
              notification and, where required, seek renewed consent before processing continues.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or your data, contact us at:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <div className="bg-muted rounded-lg p-5 text-sm text-muted-foreground">
            <p>
              MacNutrition collects health and nutrition data to provide personalised AI-powered
              coaching. Your data is encrypted, never sold, and fully controllable by you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

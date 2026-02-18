import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "18 February 2026";
const CONTACT_EMAIL = "support@macnutrition.co.uk";

const TermsOfService = () => {
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
          <h1 className="text-3xl font-bold text-foreground">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="space-y-10 text-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using MacNutrition, you agree to be bound by these Terms
              &amp; Conditions. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
            <p>
              MacNutrition provides digital nutrition tracking tools, AI-powered coaching, meal
              planning, and related features to support your health goals. The service is available
              via web, iOS, and Android.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Medical Disclaimer</h2>
            <div className="bg-muted px-4 py-3 rounded-lg">
              <p>
                <strong>This service does not provide medical advice.</strong> All content,
                AI-generated recommendations, meal plans, and nutritional estimates are for
                informational purposes only and do not constitute medical advice, diagnosis, or
                treatment.
              </p>
              <p className="mt-2">
                Always consult a qualified healthcare professional or registered dietitian before
                making significant changes to your diet or health routine, particularly if you have
                a medical condition.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Subscriptions &amp; Billing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                A free trial period may be available (duration shown at sign-up). After the trial,
                billing begins automatically.
              </li>
              <li>
                Subscriptions renew automatically on a recurring basis unless cancelled before the
                renewal date.
              </li>
              <li>
                All payments are processed securely by Stripe. We do not store payment card
                details.
              </li>
              <li>
                You may cancel at any time. Cancellation takes effect at the end of the current
                billing period.
              </li>
              <li>
                Refunds are considered at our discretion. Contact{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>{" "}
                within 7 days of a charge if you believe you were billed in error.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the service for any unlawful purpose</li>
              <li>Reverse engineer, decompile, or disassemble any part of the app</li>
              <li>Attempt to gain unauthorised access to any part of the service</li>
              <li>Disrupt or interfere with the service or its infrastructure</li>
              <li>Use automated tools to scrape or extract data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
            <p>
              All content, branding, design, code, and materials within MacNutrition are owned by
              or licensed to MacNutrition and protected by copyright and intellectual property law.
              You may not reproduce or create derivative works without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, MacNutrition is not liable for any indirect,
              incidental, special, or consequential damages — including but not limited to health
              outcomes, loss of data, or financial loss — arising from use of the service.
            </p>
            <p className="mt-2">
              Our total liability to you shall not exceed the amounts you have paid in the 12
              months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for conduct
              that violates these Terms or is harmful to other users, the service, or third
              parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after
              changes are posted constitutes your acceptance. We will notify you of significant
              changes via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <div className="bg-muted rounded-lg p-5 text-sm text-muted-foreground">
            <p>
              By using MacNutrition you agree to these Terms. The app provides nutrition guidance
              — not medical advice. Subscriptions are recurring and managed via Stripe. Your
              privacy and data are protected in accordance with our{" "}
              <a href="#/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;

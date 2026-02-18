import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const lastUpdated = "February 18, 2026";
  const contactEmail = "support@cjtnutrition.com";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </Link>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the MacNutrition app operated by CJT Nutrition Ltd ("we", "our", or "us"),
              you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              MacNutrition provides AI-powered personalised nutrition coaching, meal tracking, meal planning,
              and related tools to help you achieve your health and fitness goals. The service is available
              via web, iOS, and Android applications.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Eligibility</h2>
            <p>
              You must be at least 18 years of age to use this service. By using MacNutrition, you represent
              and warrant that you meet this requirement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Subscription and Billing</h2>
            <ul className="list-disc pl-6">
              <li>Access to MacNutrition requires a paid subscription after any applicable trial period.</li>
              <li>Subscriptions are billed on a recurring basis (monthly or annually, depending on your plan).</li>
              <li>All payments are processed securely by Stripe. We do not store your payment card details.</li>
              <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>Refunds are issued at our discretion. Contact us within 7 days of a charge if you believe you were billed in error.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Not Medical Advice</h2>
            <p>
              MacNutrition provides general nutrition information and AI-generated recommendations for
              informational and educational purposes only. This is <strong>not medical advice</strong> and
              does not replace consultation with a qualified healthcare professional, registered dietitian,
              or physician. Always seek professional guidance before making significant changes to your diet,
              especially if you have a medical condition.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. User Accounts</h2>
            <ul className="list-disc pl-6">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree to provide accurate and complete information when creating your account.</li>
              <li>You must notify us immediately of any unauthorised use of your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorised access to any part of the service</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the app</li>
              <li>Upload content that is harmful, offensive, or infringes on third-party rights</li>
              <li>Use automated tools to scrape or extract data from the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Intellectual Property</h2>
            <p>
              All content, design, code, and materials within MacNutrition are the property of CJT Nutrition Ltd
              or its licensors, protected by copyright and intellectual property laws. You may not reproduce,
              distribute, or create derivative works without our written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. AI-Generated Content</h2>
            <p>
              The app uses artificial intelligence to generate meal plans, nutritional estimates, and coaching
              responses. AI outputs may not always be accurate. You are responsible for reviewing recommendations
              before acting on them. We are not liable for decisions made based on AI-generated content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, CJT Nutrition Ltd shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the service, including but
              not limited to loss of data, health outcomes, or financial loss.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to MacNutrition at any time, with or
              without notice, for conduct that we believe violates these Terms or is harmful to other users,
              us, or third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after changes are
              posted constitutes your acceptance of the revised Terms. We will notify you of significant
              changes via email or in-app notification.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be subject to
              the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Contact Us</h2>
            <p>If you have questions about these Terms, contact us at:</p>
            <p className="mt-2">
              <strong>Email:</strong>{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </p>
          </section>

          <section className="mb-8 p-4 bg-muted rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Summary</h2>
            <p className="text-sm text-muted-foreground">
              By using MacNutrition you agree to these terms. The app provides nutrition guidance, not medical
              advice. Subscriptions are recurring and managed via Stripe. We protect your data and your privacy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const lastUpdated = "February 18, 2026";
  const contactEmail = "privacy@cjtnutrition.com";

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
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p>
              CJT Nutrition Ltd ("we", "our", or "us") operates the MacNutrition platform,
              including our web application, iOS app, and Android app (collectively, the "App").
            </p>
            <p>
              Your privacy is important to us. This Privacy Policy explains what information we collect,
              how we use it, how it is shared, and the choices you have when using our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p>
              We collect information you provide directly, information generated through your use of the App,
              and information from connected services.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">2.1 Account Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Email address and authentication credentials</li>
              <li>First name (used for personalised coaching)</li>
              <li>Language preference (English, French, Spanish, Italian, Portuguese)</li>
              <li>Preferred coaching tone (Direct, Supportive, Educational, Motivational)</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.2 Health and Body Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Age, biological sex, height, and weight</li>
              <li>Body measurements (waist, hip, chest, arms, thighs, neck)</li>
              <li>Body fat percentage</li>
              <li>Medical conditions and allergies (if provided)</li>
              <li>Dietary restrictions and food preferences</li>
              <li>Progress photos (front, back, left, and right views)</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.3 Lifestyle and Behavioural Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Activity level and workout types</li>
              <li>Job activity level and work hours</li>
              <li>Sleep patterns and perceived stress levels</li>
              <li>Eating behaviours (hunger cues, emotional eating tendencies)</li>
              <li>Cooking skill level and meal preparation preferences</li>
              <li>Past diet history and nutrition challenges</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.4 Daily Tracking Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Logged meals (food names, calories, protein, carbohydrates, fats)</li>
              <li>Food photos uploaded for AI-based nutritional analysis</li>
              <li>Water intake records</li>
              <li>Daily check-ins (mood, energy, sleep quality, stress, hunger)</li>
              <li>Activity streaks and consistency metrics</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.5 AI Coaching Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Conversations with our AI coach</li>
              <li>AI-generated meal plans and recommendations</li>
              <li>Weekly progress summaries and feedback</li>
              <li>Personalised calorie and macronutrient targets</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.6 Wearable Device Data</h3>
            <p className="mb-2">
              If you connect a supported wearable device (such as WHOOP, Garmin, Apple Watch, or Fitbit),
              we may collect:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Sleep duration, quality, and stages (light, deep, REM)</li>
              <li>Heart rate and heart rate variability (HRV)</li>
              <li>Recovery and strain metrics</li>
              <li>Steps, active minutes, and calories burned</li>
              <li>Stress and readiness indicators</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.7 Payment Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Subscription status and billing history</li>
              <li>All payments are processed securely by Stripe.</li>
              <li>We do not store or process credit card details on our servers.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-6">
              <li>Calculate personalised calorie and macronutrient targets</li>
              <li>Deliver AI-powered nutrition coaching tailored to your goals and preferences</li>
              <li>Generate meal plans that respect dietary restrictions and allergies</li>
              <li>Analyse food photos to estimate nutritional content</li>
              <li>Adjust recommendations using wearable data (sleep, recovery, activity)</li>
              <li>Track progress and visualise trends over time</li>
              <li>Send trial reminders, billing notices, and account-related messages</li>
              <li>Improve our AI models and overall service quality</li>
              <li>Provide customer support and respond to enquiries</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. AI-Powered Features</h2>
            <p>The App uses artificial intelligence to generate insights and recommendations, including:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>Food Photo Analysis</strong> – estimating nutritional content from uploaded images</li>
              <li><strong>AI Coach</strong> – personalised guidance based on your goals, check-ins, and history</li>
              <li><strong>Meal Plan Generation</strong> – weekly meal plans aligned with your macros</li>
              <li><strong>Recipe Import</strong> – extracting nutrition data from recipe descriptions</li>
              <li><strong>Ingredient Swaps</strong> – suggesting alternatives for allergies or preferences</li>
            </ul>
            <p className="mt-4">
              <strong>Important:</strong> AI-generated recommendations are provided for informational purposes only
              and do not replace professional medical or nutritional advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-2">We do not sell your personal information.</p>
            <p className="mb-2">We may share limited data with trusted third parties only as necessary to operate the service:</p>
            <ul className="list-disc pl-6">
              <li><strong>Cloud Infrastructure Providers</strong> – for secure data storage and hosting</li>
              <li><strong>Payment Processor (Stripe)</strong> – to process subscriptions securely</li>
              <li><strong>Email Services</strong> – to send account notifications and reminders</li>
              <li><strong>Wearable Platform Providers</strong> – to exchange data you authorise (e.g., WHOOP, Garmin, Fitbit, Apple Health)</li>
              <li><strong>AI Service Providers</strong> – anonymised or pseudonymised data used to generate recommendations</li>
              <li><strong>Legal Authorities</strong> – when required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Data Security</h2>
            <p>We use industry-standard security measures, including:</p>
            <ul className="list-disc pl-6">
              <li>Encryption in transit (HTTPS/TLS) and at rest</li>
              <li>Row-level access controls to ensure users can only access their own data</li>
              <li>Secure email-based authentication with verification</li>
              <li>OAuth 2.0 for wearable integrations</li>
              <li>Regular monitoring and security reviews</li>
              <li>Secure token handling for third-party connections</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the service.
            </p>
            <p className="mt-2">Tracking data (meals, check-ins, progress history) is retained to:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Display long-term trends</li>
              <li>Maintain AI coaching accuracy</li>
            </ul>
            <p className="mt-2">
              You may request deletion at any time. Upon account deletion, personal data is removed within 30 days,
              unless retention is legally required.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-6">
              <li><strong>Access</strong> – view your data in the app</li>
              <li><strong>Correction</strong> – update profile information and preferences</li>
              <li><strong>Deletion</strong> – request full account and data deletion</li>
              <li><strong>Portability</strong> – export your nutrition and progress data</li>
              <li><strong>Withdraw Consent</strong> – disconnect wearable devices at any time</li>
              <li><strong>Opt-Out</strong> – unsubscribe from non-essential communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Wearable Device Integrations</h2>
            <p>When you connect a wearable device, you authorise us to access its health and fitness data to:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Auto-fill daily check-ins</li>
              <li>Provide recovery-aware nutrition guidance</li>
              <li>Adjust calorie targets based on activity</li>
            </ul>
            <p className="mt-2">
              You can disconnect wearables at any time. After disconnection, no new data is collected.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Progress Photos</h2>
            <p>Progress photos are:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Stored securely</li>
              <li>Accessible only to you</li>
              <li>Never shared publicly or used for marketing</li>
            </ul>
            <p className="mt-2">You may delete progress photos at any time through the app.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Cookies and Local Storage</h2>
            <p>We use cookies and local storage to:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Maintain authenticated sessions</li>
              <li>Store language and theme preferences</li>
              <li>Enable offline functionality</li>
            </ul>
            <p className="mt-2">We do not use advertising or tracking cookies.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. International Data Transfers</h2>
            <p>
              Your data may be processed on servers outside your country of residence.
              Appropriate safeguards are applied in accordance with applicable data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">13. Children's Privacy</h2>
            <p>
              Our services are not intended for individuals under 18 years of age.
              We do not knowingly collect personal data from minors.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page,
              the "Last updated" date will be revised, and significant changes will be communicated via email.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">15. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </p>
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
              MacNutrition collects health, nutrition, and lifestyle data to provide personalised
              AI-powered nutrition coaching. Your data is encrypted, securely stored, never sold, and fully
              controllable by you.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

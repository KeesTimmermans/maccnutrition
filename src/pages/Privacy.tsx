import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const lastUpdated = "December 18, 2024";
  const appName = "CJT Nutrition Coaching";
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
          <h1 className="text-3xl font-bold mb-2">{appName} Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p>
              {appName} ("we," "our," or "us") is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your 
              information when you use our nutrition coaching application and related services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mb-2">2.1 Personal Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Email address and account credentials</li>
              <li>Name and profile information</li>
              <li>Age, sex, height, and weight</li>
              <li>Dietary preferences and restrictions</li>
              <li>Health goals and fitness objectives</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.2 Wearable Device Data</h3>
            <p className="mb-2">
              When you connect a wearable device (such as WHOOP, Garmin, Apple Watch, or Fitbit), 
              we may collect:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Sleep data (duration, quality, sleep stages)</li>
              <li>Heart rate and heart rate variability (HRV)</li>
              <li>Recovery and strain scores</li>
              <li>Activity and exercise data</li>
              <li>Steps and calories burned</li>
              <li>Stress levels and body battery metrics</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.3 Nutrition Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Meals logged and food consumption</li>
              <li>Macronutrient and calorie intake</li>
              <li>Water intake</li>
              <li>Meal preferences and favorite foods</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.4 Usage Data</h3>
            <ul className="list-disc pl-6">
              <li>App usage patterns and feature interactions</li>
              <li>Device information and browser type</li>
              <li>Log data and analytics</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-6">
              <li>Provide personalized nutrition recommendations based on your recovery, sleep, and activity data</li>
              <li>Generate meal plans tailored to your goals and preferences</li>
              <li>Track your progress and provide insights</li>
              <li>Optimize recommendations using AI-powered coaching</li>
              <li>Improve our services and develop new features</li>
              <li>Communicate with you about your account and updates</li>
              <li>Ensure the security and integrity of our platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="mb-2">We do not sell your personal information. We may share your data with:</p>
            <ul className="list-disc pl-6">
              <li><strong>Service Providers:</strong> Third-party services that help us operate our platform (e.g., cloud hosting, analytics)</li>
              <li><strong>Wearable Partners:</strong> Data is exchanged with connected wearable platforms (WHOOP, Garmin, etc.) as authorized by you</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication mechanisms</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and employee training</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed 
              to provide you services. You may request deletion of your data at any time. Upon account 
              deletion, we will remove your personal information within 30 days, except where retention 
              is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-6">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Withdraw Consent:</strong> Disconnect wearable devices or revoke permissions at any time</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Wearable Device Integrations</h2>
            <p>
              When you connect a wearable device, you authorize us to access your health and fitness 
              data from that platform. You can disconnect your wearable device at any time through 
              your account settings. Upon disconnection, we will stop collecting new data from that 
              device, though previously collected data will be retained unless you request deletion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Children's Privacy</h2>
            <p>
              Our services are not intended for users under 18 years of age. We do not knowingly 
              collect personal information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any 
              material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Email:</strong> {contactEmail}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

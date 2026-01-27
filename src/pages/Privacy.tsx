import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const lastUpdated = "January 27, 2026";
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
              information when you use our nutrition coaching application and related services,
              including our web app, iOS app, and Android app.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mb-2">2.1 Account Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Email address and authentication credentials</li>
              <li>First name for personalized coaching</li>
              <li>Language preference (English, French, Spanish, Italian, Portuguese)</li>
              <li>Preferred coaching tone (Direct, Supportive, Educational, Motivational)</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.2 Health & Body Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Age, biological sex, height, and weight</li>
              <li>Body measurements (waist, hip, chest, arm, thigh, neck circumferences)</li>
              <li>Body fat percentage</li>
              <li>Progress photos (front, back, left side, right side views)</li>
              <li>Medical conditions and allergies</li>
              <li>Dietary restrictions and preferences</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.3 Lifestyle & Behavioral Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Activity level and workout types</li>
              <li>Job activity level and work hours</li>
              <li>Sleep patterns and stress levels</li>
              <li>Eating habits (speed, hunger patterns, emotional eating tendencies)</li>
              <li>Cooking skill and meal prep preferences</li>
              <li>Past diet history and nutrition challenges</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.4 Daily Tracking Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Meals logged (food names, calories, protein, carbs, fats)</li>
              <li>Food photos uploaded for AI analysis</li>
              <li>Water intake records</li>
              <li>Daily check-ins (mood, energy, sleep quality, stress, hunger levels)</li>
              <li>Activity streaks and consistency metrics</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.5 AI Coaching Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Conversations with our AI coach</li>
              <li>Generated meal plans and recommendations</li>
              <li>Weekly progress updates and feedback</li>
              <li>Personalized macro and calorie targets</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.6 Wearable Device Data</h3>
            <p className="mb-2">
              When you connect a wearable device (such as WHOOP, Garmin, Apple Watch, or Fitbit), 
              we may collect:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Sleep data (duration, quality, sleep stages including deep, REM, light sleep)</li>
              <li>Heart rate and heart rate variability (HRV)</li>
              <li>Recovery and strain scores</li>
              <li>Steps, active minutes, and calories burned</li>
              <li>Stress levels and body battery metrics</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">2.7 Payment Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Subscription status and billing history</li>
              <li>Payment processing is handled securely by Stripe; we do not store your credit card details</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-6">
              <li>Calculate personalized calorie and macro targets based on your goals, body composition, and activity level</li>
              <li>Provide AI-powered nutrition coaching tailored to your preferences and history</li>
              <li>Generate personalized meal plans that respect your dietary restrictions and allergies</li>
              <li>Analyze food photos to estimate nutritional content</li>
              <li>Adjust recommendations based on your wearable data (sleep, recovery, activity)</li>
              <li>Track your progress and provide insights on trends</li>
              <li>Send trial reminders and subscription notifications</li>
              <li>Improve our AI models and service quality</li>
              <li>Provide customer support</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. AI-Powered Features</h2>
            <p>
              Our app uses artificial intelligence to analyze your data and provide personalized recommendations.
              This includes:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>Food Photo Analysis:</strong> AI analyzes images of your meals to estimate nutritional content</li>
              <li><strong>AI Coach:</strong> Provides personalized guidance based on your check-ins, progress, and goals</li>
              <li><strong>Meal Plan Generation:</strong> Creates weekly meal plans tailored to your macros and preferences</li>
              <li><strong>Recipe Import:</strong> Extracts nutritional information from recipe descriptions</li>
              <li><strong>Ingredient Swaps:</strong> Suggests alternatives based on your dietary restrictions</li>
            </ul>
            <p className="mt-2">
              AI-generated recommendations are for informational purposes only and should not replace professional medical or nutritional advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-2">We do not sell your personal information. We may share your data with:</p>
            <ul className="list-disc pl-6">
              <li><strong>Cloud Infrastructure:</strong> Your data is stored securely using industry-standard cloud services</li>
              <li><strong>Payment Processor:</strong> Stripe processes payments securely on our behalf</li>
              <li><strong>Email Services:</strong> For sending account notifications and trial reminders</li>
              <li><strong>Wearable Partners:</strong> Data is exchanged with connected wearable platforms (WHOOP, Garmin, Fitbit, Apple Health) as authorized by you</li>
              <li><strong>AI Providers:</strong> Anonymized data may be processed by AI services to generate recommendations</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6">
              <li>Encryption of data in transit (HTTPS/TLS) and at rest</li>
              <li>Row-level security ensuring users can only access their own data</li>
              <li>Secure authentication with email verification</li>
              <li>OAuth 2.0 for wearable device connections</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure token storage for third-party integrations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed 
              to provide you services. Your tracking data (meals, check-ins, progress updates) is 
              retained to show historical trends and support AI coaching accuracy. You may request 
              deletion of your data at any time. Upon account deletion, we will remove your personal 
              information within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-6">
              <li><strong>Access:</strong> View all your personal data through the app settings</li>
              <li><strong>Correction:</strong> Update your profile, measurements, and preferences at any time</li>
              <li><strong>Deletion:</strong> Request deletion of your account and all associated data</li>
              <li><strong>Portability:</strong> Export your meal history and progress data</li>
              <li><strong>Withdraw Consent:</strong> Disconnect wearable devices or revoke permissions at any time</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Wearable Device Integrations</h2>
            <p>
              When you connect a wearable device, you authorize us to access your health and fitness 
              data from that platform. This data is used to:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Auto-fill daily check-in fields (sleep, energy, stress)</li>
              <li>Provide recovery-aware nutrition recommendations</li>
              <li>Adjust calorie targets based on activity levels</li>
            </ul>
            <p className="mt-2">
              You can disconnect your wearable device at any time through the app settings. 
              Upon disconnection, we will stop collecting new data from that device, though 
              previously collected data will be retained unless you request deletion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Progress Photos</h2>
            <p>
              Progress photos you upload are stored securely and are only accessible to you. 
              These photos are never shared with other users, used for marketing, or processed 
              by AI for any purpose other than displaying them back to you in your progress history.
              You can delete your progress photos at any time through the app settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Cookies and Local Storage</h2>
            <p>
              Our app uses local storage and cookies to:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Maintain your authenticated session</li>
              <li>Store your language and theme preferences</li>
              <li>Cache data for offline functionality</li>
            </ul>
            <p className="mt-2">
              We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. International Data Transfers</h2>
            <p>
              Your data may be processed and stored on servers located outside your country of residence. 
              We ensure appropriate safeguards are in place for any international data transfers in 
              accordance with applicable data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">13. Children's Privacy</h2>
            <p>
              Our services are not intended for users under 18 years of age. We do not knowingly 
              collect personal information from children. If you believe we have collected data 
              from a minor, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any 
              material changes by posting the new policy on this page, updating the "Last updated" 
              date, and sending you an email notification for significant changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">15. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
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
              We collect health, nutrition, and lifestyle data to provide personalized AI-powered 
              nutrition coaching. Your data is encrypted, secured with row-level access controls, 
              and never sold. You can access, update, or delete your data at any time.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

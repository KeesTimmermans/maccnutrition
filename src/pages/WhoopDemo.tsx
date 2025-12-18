import { Watch, Moon, Heart, Activity, Zap, Brain, TrendingUp, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WhoopDemo = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/lovable-uploads/cjt-logo.png" alt="CJT Nutrition" className="h-12" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-3xl font-bold">CJT Nutrition</h1>
            <span className="text-2xl">×</span>
            <div className="bg-black text-white px-3 py-1 rounded font-bold">WHOOP</div>
          </div>
          <p className="text-lg opacity-90">Personalized nutrition coaching powered by your WHOOP data</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {/* Overview Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">How We Use WHOOP Data</h2>
          <p className="text-muted-foreground mb-6">
            CJT Nutrition integrates your WHOOP metrics to provide personalized nutrition recommendations 
            that adapt to your body's recovery, strain, and sleep patterns.
          </p>
          
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon: Heart, label: "Recovery Score", color: "text-green-500" },
              { icon: Moon, label: "Sleep Data", color: "text-blue-500" },
              { icon: Activity, label: "HRV", color: "text-purple-500" },
              { icon: Zap, label: "Strain Score", color: "text-orange-500" },
            ].map(({ icon: Icon, label, color }) => (
              <Card key={label} className="text-center">
                <CardContent className="pt-6">
                  <Icon className={`h-8 w-8 mx-auto mb-2 ${color}`} />
                  <p className="font-medium text-sm">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Dashboard Integration */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">1. Dashboard Integration</h2>
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center gap-2">
                <Watch className="h-5 w-5" />
                Today's WHOOP Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <Heart className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-green-600">78%</p>
                  <p className="text-xs text-muted-foreground">Recovery</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <Moon className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-blue-600">7.5h</p>
                  <p className="text-xs text-muted-foreground">Sleep</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <Activity className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-purple-600">52ms</p>
                  <p className="text-xs text-muted-foreground">HRV</p>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                  <Zap className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold text-orange-600">12.4</p>
                  <p className="text-xs text-muted-foreground">Strain</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Daily Check-in Integration */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">2. Smart Daily Check-in</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Auto-Suggested from WHOOP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  📊 Based on your WHOOP recovery score of 78%, we've pre-filled your check-in:
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">😊</p>
                    <p className="text-xs text-muted-foreground">Mood: Good</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">⚡</p>
                    <p className="text-xs text-muted-foreground">Energy: High</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">😌</p>
                    <p className="text-xs text-muted-foreground">Stress: Low</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your WHOOP data helps us understand how you're feeling before you even tell us, 
                making check-ins faster and more accurate.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* AI Coach Integration */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">3. AI Nutrition Coach</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Personalized Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">AI</div>
                  <div className="flex-1 bg-background rounded-lg p-3 shadow-sm">
                    <p className="text-sm">
                      Good morning! I see your WHOOP recovery is at <strong>78%</strong> with a strain of <strong>12.4</strong> yesterday. 
                      Your body handled that workout well! 
                    </p>
                    <p className="text-sm mt-2">
                      Today I recommend focusing on <strong>complex carbs</strong> to replenish glycogen stores. 
                      Consider adding an extra 15g of protein post-workout to support muscle recovery.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">AI</div>
                  <div className="flex-1 bg-background rounded-lg p-3 shadow-sm">
                    <p className="text-sm">
                      💡 <strong>Based on your HRV trend:</strong> Your HRV has been improving over the past week (avg 48ms → 52ms). 
                      This suggests good adaptation to training. Keep prioritizing sleep and hydration!
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Meal Planning Integration */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">4. Adaptive Meal Planning</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Recovery-Based Nutrition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <p className="font-medium text-sm">High Recovery Day (70%+)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Higher carb allocation for training performance. 
                      Suggested: 45% carbs, 30% protein, 25% fats
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <p className="font-medium text-sm">Medium Recovery (40-70%)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Balanced macros with emphasis on recovery foods. 
                      Suggested: 40% carbs, 35% protein, 25% fats
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <p className="font-medium text-sm">Low Recovery Day (&lt;40%)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anti-inflammatory focus with extra hydration reminders. 
                      Suggested: 35% carbs, 35% protein, 30% fats
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <p className="font-medium text-sm">High Strain Day (15+)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Increased calorie and carb suggestions for recovery. 
                      +200-400 calories recommended
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Data Privacy */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Data Privacy & Security</h2>
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Your WHOOP data is securely stored and encrypted
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Data is only used to personalize your nutrition recommendations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  You can disconnect WHOOP at any time from settings
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  We never share your data with third parties
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to optimize your nutrition?</h2>
          <p className="text-muted-foreground mb-6">
            Connect your WHOOP and let AI-powered nutrition coaching adapt to your body.
          </p>
          <a 
            href="/" 
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started Free
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/50 py-6 px-4 text-center text-sm text-muted-foreground">
        <p>© 2024 CJT Nutrition. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default WhoopDemo;

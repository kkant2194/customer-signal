"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading, configured, error, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [router, user]);

  async function handleLogin() {
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast({ title: "Logged in", description: "Welcome back to Customer Signal.", variant: "success" });
      router.replace("/dashboard");
    } catch (nextError) {
      toast({
        title: "Login failed",
        description: nextError instanceof Error ? nextError.message : "Check your credentials and try again.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup() {
    setSubmitting(true);
    try {
      await signUp(email, password, fullName);
      toast({ title: "Account created", description: "You can now use your customer feedback workspace.", variant: "success" });
      router.replace("/dashboard");
    } catch (nextError) {
      toast({
        title: "Signup failed",
        description: nextError instanceof Error ? nextError.message : "Try a different email or password.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Waves className="h-5 w-5" />
          </div>
          <CardTitle>Customer Signal</CardTitle>
          <CardDescription>Sign in to access your customer feedback workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              The app is not fully configured yet. Add the required deployment settings before signing in.
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="space-y-4">
                <AuthFields
                  email={email}
                  password={password}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                />
                <Button className="w-full" disabled={loading || submitting} onClick={handleLogin}>
                  {submitting ? "Logging in..." : "Login"}
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Maya Patel" />
                </div>
                <AuthFields
                  email={email}
                  password={password}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                />
                <Button className="w-full" disabled={loading || submitting} onClick={handleSignup}>
                  {submitting ? "Creating account..." : "Create account"}
                </Button>
              </TabsContent>
            </Tabs>
          )}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function AuthFields({
  email,
  password,
  onEmailChange,
  onPasswordChange
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="pm@company.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Minimum 6 characters" />
      </div>
    </>
  );
}

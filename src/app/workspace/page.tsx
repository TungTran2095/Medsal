
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export default function WorkspacePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="items-center">
          <Briefcase className="h-12 w-12 mb-4 text-primary" />
          <CardTitle className="text-2xl font-bold">Workspace</CardTitle>
          <CardDescription>This is your dedicated workspace. Start managing your projects and tasks here.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Workspace functionality will be implemented here.
          </p>
          <div className="mt-8">
            <img 
              src="https://placehold.co/600x400.png" 
              alt="Workspace placeholder" 
              data-ai-hint="office workspace"
              className="rounded-lg shadow-md mx-auto"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

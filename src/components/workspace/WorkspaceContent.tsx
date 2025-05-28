
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export default function WorkspaceContent() {
  return (
    <Card className="w-full h-full flex flex-col shadow-md rounded-lg">
      <CardHeader className="items-center">
        <Briefcase className="h-12 w-12 mb-4 text-primary" />
        <CardTitle className="text-2xl font-bold">Workspace</CardTitle>
        <CardDescription>Your dedicated workspace for projects and tasks.</CardDescription>
      </CardHeader>
      <CardContent className="text-center flex-grow flex flex-col justify-center items-center p-4 md:p-6">
        <p className="text-muted-foreground mb-6">
          Workspace functionality will be implemented here.
        </p>
        <div className="w-full max-w-md">
          <img
            src="https://placehold.co/600x400.png"
            alt="Workspace placeholder"
            data-ai-hint="office workspace"
            className="rounded-lg shadow-md mx-auto w-full h-auto object-contain"
          />
        </div>
      </CardContent>
    </Card>
  );
}

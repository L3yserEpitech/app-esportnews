"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image } from "lucide-react";

export default function MediaPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Médias</h1>
        <p className="mt-2 text-sm text-gray-700">
          Gérez vos médias (images, vidéos)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Bibliothèque de médias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Image className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">
              Cette fonctionnalité sera bientôt disponible
            </p>
            <p className="text-sm text-gray-400">
              Vous pourrez gérer toutes vos images et vidéos depuis cette page
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

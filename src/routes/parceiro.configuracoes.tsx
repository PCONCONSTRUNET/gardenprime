import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabaseParceiro as supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, UserCircle, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/parceiro/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Parceiro" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [vendedor, setVendedor] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data: vData } = await supabase
          .from("vendedores")
          .select("*")
          .eq("user_id", userData.user.id)
          .single();

        if (vData) {
          setVendedor(vData);
          setPreviewUrl(vData.avatar_url || null);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          let width = img.width;
          let height = img.height;
          
          // Max dimensions (can adjust if needed)
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to WebP or JPEG
          let quality = 0.9;
          const compress = () => {
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error("Canvas to Blob failed"));
                return;
              }
              // Check if < 800kb
              if (blob.size > 800 * 1024 && quality > 0.1) {
                quality -= 0.1;
                compress();
              } else {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
              }
            }, "image/jpeg", quality);
          };
          compress();
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    try {
      // 1. Compress image if it exceeds 800kb (though compress function handles the shrinking loop)
      const compressedFile = await compressImage(file);
      
      // 2. Upload to Supabase Storage (bucket: avatars)
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${vendedor.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // 3. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 4. Update Vendedor record in database
      const { error: dbError } = await supabase
        .from("vendedores")
        .update({ avatar_url: publicUrl })
        .eq("id", vendedor.id);

      if (dbError) throw dbError;

      toast.success("Foto de perfil atualizada com sucesso!");
      setPreviewUrl(publicUrl);
    } catch (error: any) {
      console.error("Erro ao enviar foto:", error);
      let errorMsg = error?.message || "Erro desconhecido";
      if (errorMsg.includes("avatar_url")) {
        errorMsg = "A coluna 'avatar_url' não existe na tabela vendedores.";
      }
      if (errorMsg.includes("Bucket not found") || error?.error === "Bucket not found" || errorMsg.includes("bucket")) {
        errorMsg = "O bucket 'avatars' não existe no Supabase. Crie-o primeiro.";
      }
      toast.error("Erro ao enviar foto: " + errorMsg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie seu perfil e preferências do aplicativo.</p>
      </div>

      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
          <CardTitle className="text-xl">Foto de Perfil</CardTitle>
          <CardDescription>
            Faça upload de uma foto para personalizar seu perfil. O tamanho máximo é 800KB (iremos comprimir automaticamente se for maior).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center ring-4 ring-slate-50">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-20 h-20 text-slate-300" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2.5 bg-[#171F1E] hover:bg-[#171F1E]/90 text-[#C5A059] rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>
            </div>
            
            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div>
                <h3 className="font-semibold text-slate-900">{vendedor?.nome || "Vendedor"}</h3>
                <p className="text-sm text-slate-500">{vendedor?.email || "Email não informado"}</p>
              </div>
              
              <div className="space-y-2">
                <input 
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full sm:w-auto gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  Escolher Imagem
                </Button>
                <p className="text-xs text-slate-400">
                  JPG, PNG ou WebP permitidos.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Aqui podem vir outras configurações no futuro (senhas, preferências, etc) */}
    </div>
  );
}

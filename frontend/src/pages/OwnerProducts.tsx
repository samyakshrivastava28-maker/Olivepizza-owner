import { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Clipboard } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { useAuthStore } from '../lib/store';
import {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} from '../lib/cloudinary';
import { getCurrentAuthToken } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import ProductCard from '../components/ProductCard';
import ComboBuilder from '../components/owner/ComboBuilder';
import InlineAIImageGenerator from '../components/owner/InlineAIImageGenerator';
import UnifiedImageSelectorHub from '../components/owner/UnifiedImageSelectorHub';
import AIDeepSeekAssistantChatbox from '../components/owner/AIDeepSeekAssistantChatbox';
import toast from 'react-hot-toast';

export default function OwnerProducts() {
  const [isAIStudioOpen, setIsAIStudioOpen] = useState(false);

  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<any>({
    productName: "",
    description: "",
    category: "pizza",
    pricingMode: "fixed",
    basePrice: 0,
    offerPrice: 0,
    discountPercentage: 0,
    isVegetarian: true,
    isActive: true,
    isComboOnly: false,
    variants: [],
    crusts: [],
    addons: [],
  });
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products');
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // AI Image State
  const [aiGeneratedImageUrl, setAiGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const [aiGeneratedPublicId, setAiGeneratedPublicId] = useState<string | null>(
    null,
  );
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageType, setImageType] = useState("product_photo");
  const [aiModel, setAiModel] = useState("qwen-image");
  const [customImagePrompt, setCustomImagePrompt] = useState("");
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // AI Description Chat State
  const [chatMessages, setChatMessages] = useState<
    { role: string; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const q = collection(db, "products");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      productData.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setItems(productData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const newMessages = [...chatMessages, { role: "user", content: chatInput }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/ai/product-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();

      if (data.text) {
        let aiResponse = data.text;
        const finalDescMatch = aiResponse.match(/FINAL_DESCRIPTION:\s*(.*)/is);

        if (finalDescMatch) {
          const description = finalDescMatch[1].trim();
          setNewItem((prev: any) => ({ ...prev, description }));
          aiResponse =
            aiResponse.replace(/FINAL_DESCRIPTION:\s*.*/is, "").trim() +
            "\n\n✨ I have filled in the description for you!";
        }

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: aiResponse },
        ]);
      }
    } catch (error) {
      console.error(error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oops! Something went wrong trying to connect to the AI.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    console.log("STEP 2: Starting handleUpload function");
    if (!user) throw new Error("Not authenticated");
    setUploading(true);
    setUploadProgress(0);
    try {
      console.log("STEP 3: Calling uploadMediaToCloudinary");
      const result = await uploadMediaToCloudinary(
        file,
        "Olive Pizza",
        setUploadProgress,
      );
      console.log("STEP 4: Cloudinary upload successful", result);

      // Also add to media_library
      await addDoc(collection(db, "media_library"), {
        mediaUrl: result.secureUrl,
        cloudinaryPublicId: result.publicId,
        mediaType: result.type,
        format: result.format,
        bytes: result.bytes,
        uploadedBy: user.uid,
        uploadedAt: new Date().toISOString(),
      });

      return result;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEnhanceImagePrompt = async () => {
    if (!newItem.productName) {
      toast.error("Please enter a product name first to enhance the prompt!");
      return;
    }
    const basePrompt =
      customImagePrompt ||
      `Delicious ${newItem.productName}, ${newItem.description || ""}`;
    setIsEnhancingPrompt(true);
    const toastId = toast.loading("Enhancing prompt with AI...");
    try {
      const res = await fetch("/api/ai/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: basePrompt, type: "product" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomImagePrompt(data.text);
        toast.success("Prompt enhanced!", { id: toastId });
      } else {
        toast.error("Failed to enhance prompt: " + (data.error || "Unknown error"), { id: toastId });
      }
    } catch (e: any) {
      toast.error("Error enhancing prompt: " + e.message, { id: toastId });
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleGenerateAIImage = async () => {
    if (!newItem.productName) {
      toast.error("Please enter a product name first!");
      return;
    }
    setIsGeneratingImage(true);
    const toastId = toast.loading("Generating AI product image...");
    try {
      const res = await fetch("/api/ai/generate-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: newItem.productName,
          description: newItem.description,
          category: newItem.category,
          ingredients: newItem.description, // fallback
          imageType: imageType,
          customPrompt: customImagePrompt,
          modelName: aiModel,
          baseImageUrl: aiGeneratedImageUrl || editingItem?.imageUrl || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiGeneratedImageUrl(data.imageUrl);
        setAiGeneratedPublicId(data.publicId);
        toast.success("Product image generated successfully!", { id: toastId });
      } else {
        toast.error("Failed to generate image: " + (data.error || "Unknown error"), { id: toastId });
      }
    } catch (e: any) {
      toast.error("Error generating image: " + e.message, { id: toastId });
    } finally {
      setIsGeneratingImage(false);
    }
  };


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("STEP 1: Form Submitted - handleCreate");
    try {
      let mediaData = { imageUrl: "", cloudinaryPublicId: "" };
      if (selectedFile) {
        console.log("STEP 1b: Image detected, proceeding to upload");
        const result = await handleUpload(selectedFile);
        mediaData = {
          imageUrl: result.secureUrl,
          cloudinaryPublicId: result.publicId,
        };
      } else if (aiGeneratedImageUrl) {
        if (aiGeneratedImageUrl.startsWith("data:") || aiGeneratedImageUrl.startsWith("blob:")) {
          const token = await getCurrentAuthToken().catch(() => "");
          const res = await fetch("/api/ai/image/approve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              imageUrl: aiGeneratedImageUrl,
              folder: "olive-pizza/ai-product-images",
            }),
          });
          const data = await res.json();
          if (data.success && data.cloudinaryUrl) {
            mediaData = {
              imageUrl: data.cloudinaryUrl,
              cloudinaryPublicId: data.publicId || "",
            };
          } else {
            throw new Error(data.error || "Failed to save preview image to Cloudinary");
          }
        } else {
          mediaData = {
            imageUrl: aiGeneratedImageUrl,
            cloudinaryPublicId: aiGeneratedPublicId || "",
          };
        }
      }

      console.log("STEP 5: Saving product data to Firestore");

      await addDoc(collection(db, "products"), {
        ...newItem,
        ...mediaData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await logActivity(
        "Product Created",
        `Added ${newItem.productName}`,
        user?.email || undefined,
      );

      console.log("STEP 6: Product Creation Complete!");
      setIsAdding(false);
      setNewItem({
        productName: "",
        description: "",
        category: "pizza",
        pricingMode: "fixed",
        basePrice: 0,
        offerPrice: 0,
        discountPercentage: 0,
        isVegetarian: true,
        isActive: true,
        isComboOnly: false,
        variants: [],
        crusts: [],
        addons: [],
      });
      setSelectedFile(null);
      setAiGeneratedImageUrl(null);
      setAiGeneratedPublicId(null);
      setCustomImagePrompt("");
    } catch (error) {
      console.error("STEP FAILURE: Error creating product", error);
      alert("Error creating product. See console.");
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingItem(item);
    setNewItem({
      productName: item.productName || item.name || "",
      description: item.description || "",
      category: item.category || "pizza",
      pricingMode: item.pricingMode || (item.offerPrice ? "offer" : "fixed"),
      basePrice: item.basePrice || item.price || 0,
      offerPrice: item.offerPrice || 0,
      discountPercentage: item.discountPercentage || 0,
      isVegetarian: item.isVegetarian ?? true,
      isActive: item.isAvailable ?? item.isActive ?? true,
      isComboOnly: item.isComboOnly ?? false,
      variants: item.variants || [],
      crusts: item.crusts || [],
      addons: item.addons || [],
    });
    setAiGeneratedImageUrl(item.imageUrl || item.image || null);
    setAiGeneratedPublicId(item.cloudinaryPublicId || null);
    setSelectedFile(null);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.id || !user) return;
    setUploading(true);
    try {
      let mediaData: any = {
        imageUrl: editingItem.imageUrl || editingItem.image || "",
        cloudinaryPublicId: editingItem.cloudinaryPublicId || "",
      };

      if (selectedFile) {
        const result = await handleUpload(selectedFile);
        mediaData = {
          imageUrl: result.secureUrl,
          cloudinaryPublicId: result.publicId,
        };

        if (editingItem.cloudinaryPublicId) {
          const token = await getCurrentAuthToken().catch(() => "");
          await deleteMediaFromCloudinary(
            editingItem.cloudinaryPublicId,
            token,
          ).catch((e) => console.error("Failed to delete old image", e));
        }
      } else if (aiGeneratedImageUrl && aiGeneratedImageUrl !== (editingItem.imageUrl || editingItem.image)) {
        if (aiGeneratedImageUrl.startsWith("data:") || aiGeneratedImageUrl.startsWith("blob:")) {
          const token = await getCurrentAuthToken().catch(() => "");
          const res = await fetch("/api/ai/image/approve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              imageUrl: aiGeneratedImageUrl,
              folder: "olive-pizza/ai-product-images",
            }),
          });
          const data = await res.json();
          if (data.success && data.cloudinaryUrl) {
            mediaData = {
              imageUrl: data.cloudinaryUrl,
              cloudinaryPublicId: data.publicId || "",
            };
          }
        } else {
          mediaData = {
            imageUrl: aiGeneratedImageUrl,
            cloudinaryPublicId: aiGeneratedPublicId || "",
          };
        }
      }

      await updateDoc(doc(db, "products", editingItem.id), {
        ...newItem,
        ...mediaData,
        updatedAt: new Date().toISOString(),
      });

      await logActivity(
        "Product Updated",
        `Updated ${newItem.productName}`,
        user?.email || undefined,
      );

      toast.success(`Updated ${newItem.productName}!`);

      setEditingItem(null);
      setIsAdding(false);
      setNewItem({
        productName: "",
        description: "",
        category: "pizza",
        pricingMode: "fixed",
        basePrice: 0,
        offerPrice: 0,
        discountPercentage: 0,
        isVegetarian: true,
        isActive: true,
        isComboOnly: false,
        variants: [],
        crusts: [],
        addons: [],
      });
      setSelectedFile(null);
      setAiGeneratedImageUrl(null);
      setAiGeneratedPublicId(null);
    } catch (error: any) {
      console.error("Error updating product", error);
      toast.error("Error updating product: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = async (item: any) => {
    if (
      !confirm(
        "Are you sure you want to delete this product? This will also remove the image.",
      )
    )
      return;
    if (!user) return;
    try {
      if (item.cloudinaryPublicId) {
        const token = await getCurrentAuthToken();
        await deleteMediaFromCloudinary(item.cloudinaryPublicId, token).catch(
          (e) => console.error("Failed to delete image", e),
        );
      }
      await deleteDoc(doc(db, "products", item.id));
      await logActivity(
        "Product Deleted",
        `Deleted ${item.productName}`,
        user?.email || undefined,
      );
    } catch (error) {
      console.error("Error deleting product", error);
    }
  };

  if (loading)
    return <div className="p-8 font-bold text-center">Loading Products...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Menu Management</h1>
        {activeTab === 'products' && (
          <button
            onClick={() => {
              if (isAdding || editingItem) {
                setIsAdding(false);
                setEditingItem(null);
              } else {
                setIsAdding(true);
              }
            }}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-bold transition-colors cursor-pointer"
          >
            {editingItem ? `Cancel Editing (${editingItem.productName})` : isAdding ? "Cancel" : "+ Add New Product"}
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('products')} 
          className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'products' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          Normal Products
        </button>
        <button 
          onClick={() => setActiveTab('combos')} 
          className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'combos' ? 'bg-primary-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          Combos 🚀
        </button>
      </div>

      {activeTab === 'combos' && (
        <ComboBuilder onAddComboProduct={() => {
          setIsAdding(true);
          setActiveTab('products');
          setNewItem((prev: any) => ({ ...prev, isComboOnly: true }));
        }} />
      )}

      {activeTab === 'products' && isAdding && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <form
            onSubmit={editingItem ? handleEdit : handleCreate}
            className="xl:col-span-2 bg-[#1E293B] dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <input
              type="text"
              placeholder="Product Name"
              required
              value={newItem.productName}
              onChange={(e) =>
                setNewItem({ ...newItem, productName: e.target.value })
              }
              className="p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
            />
            {newItem.isComboOnly && (
              <div className="md:col-span-2 bg-blue-500/20 text-blue-300 p-3 rounded-xl border border-blue-500/30 text-sm font-bold flex items-center gap-2">
                ℹ️ This product is being created for COMBOS ONLY and will not appear on the regular public menu.
              </div>
            )}
            <div className="md:col-span-2 bg-[#0B0F14] border border-white/5 p-4 rounded-xl border dark:border-slate-700 space-y-4">
              <h4 className="font-bold text-sm text-slate-400">Pricing Configuration</h4>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setNewItem({ ...newItem, pricingMode: 'fixed', discountPercentage: 0 })}
                  className={`flex-1 py-2 rounded-lg font-bold ${newItem.pricingMode !== 'offer' ? 'bg-primary-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                >
                  Fixed Price
                </button>
                <button 
                  type="button"
                  onClick={() => setNewItem({ ...newItem, pricingMode: 'offer' })}
                  className={`flex-1 py-2 rounded-lg font-bold ${newItem.pricingMode === 'offer' ? 'bg-primary-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                >
                  Offer Price
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">{newItem.pricingMode !== 'offer' ? 'Final Price (₹)' : 'Original Price (₹)'}</label>
                  <input
                    type="number"
                    required
                    value={newItem.basePrice || ""}
                    onChange={(e) => {
                      const basePrice = Number(e.target.value);
                      const offerPrice = newItem.offerPrice || 0;
                      const discountPercentage = newItem.pricingMode === 'offer' && offerPrice > 0 && basePrice > offerPrice 
                        ? Math.round(((basePrice - offerPrice) / basePrice) * 100) : 0;
                      setNewItem({ ...newItem, basePrice, discountPercentage });
                    }}
                    className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                {newItem.pricingMode === 'offer' && (
                  <div className="flex-1">
                    <label className="text-xs text-primary-400 mb-1 block font-bold">Offer Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={newItem.offerPrice || ""}
                      onChange={(e) => {
                        const offerPrice = Number(e.target.value);
                        const basePrice = newItem.basePrice || 0;
                        const discountPercentage = basePrice > offerPrice 
                          ? Math.round(((basePrice - offerPrice) / basePrice) * 100) : 0;
                        setNewItem({ ...newItem, offerPrice, discountPercentage });
                      }}
                      className="w-full p-3 rounded-lg border border-primary-500/50 bg-slate-900 text-primary-100 font-bold"
                    />
                  </div>
                )}
              </div>
              {newItem.pricingMode === 'offer' && newItem.discountPercentage > 0 && (
                <div className="bg-green-500/20 text-green-400 p-2 rounded-lg font-bold text-center border border-green-500/30 text-sm">
                  Customers Save {newItem.discountPercentage}%!
                </div>
              )}
            </div>

            {/* Unified Image Selection Hub (5 Tab Modes) */}
            <div className="col-span-1 md:col-span-2">
              <UnifiedImageSelectorHub
                initialPrompt={newItem.productName || editingItem?.productName || "Tandoori Paneer Pizza"}
                targetType="product"
                defaultAspectRatio="1:1"
                currentImageUrl={aiGeneratedImageUrl || (editingItem?.imageUrl || editingItem?.image)}
                onSelectImage={(cloudinaryUrl, publicId) => {
                  setAiGeneratedImageUrl(cloudinaryUrl);
                  if (publicId) setAiGeneratedPublicId(publicId);
                  if (editingItem) {
                    setEditingItem((prev: any) => ({ ...prev, image: cloudinaryUrl, imageUrl: cloudinaryUrl }));
                  }
                  toast.success("Product image set!");
                }}
                onClearImage={() => {
                  setAiGeneratedImageUrl(null);
                  setAiGeneratedPublicId(null);
                  if (editingItem) {
                    setEditingItem((prev: any) => ({ ...prev, image: "", imageUrl: "" }));
                  }
                }}
              />
            </div>

            <select
              value={newItem.category}
              onChange={(e) =>
                setNewItem({ ...newItem, category: e.target.value })
              }
              className="p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="pizza">Pizza</option>
              <option value="sides">Sides</option>
              <option value="beverage">Beverage</option>
            </select>

            <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-200 bg-[#0B0F14] border border-white/5 p-3 rounded-lg border dark:border-slate-700">
              <input
                type="checkbox"
                checked={newItem.isVegetarian}
                onChange={(e) =>
                  setNewItem({ ...newItem, isVegetarian: e.target.checked })
                }
                className="w-5 h-5 rounded text-primary-600"
              />
              Vegetarian Options
            </label>

            <div className="md:col-span-2 space-y-4">
              <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-slate-400">
                    Sizes / Variants
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setNewItem({
                        ...newItem,
                        variants: [...newItem.variants, { name: "", price: 0 }],
                      })
                    }
                    className="text-primary-500 text-sm font-bold hover:underline"
                  >
                    + Add Size
                  </button>
                </div>
                {newItem.variants?.map((v: any, idx: number) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Size (e.g. Medium)"
                      value={v.name}
                      onChange={(e) => {
                        const nv = [...newItem.variants];
                        nv[idx].name = e.target.value;
                        setNewItem({ ...newItem, variants: nv });
                      }}
                      className="flex-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Extra Price (₹)"
                      value={v.price}
                      onChange={(e) => {
                        const nv = [...newItem.variants];
                        nv[idx].price = Number(e.target.value);
                        setNewItem({ ...newItem, variants: nv });
                      }}
                      className="w-32 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nv = newItem.variants.filter(
                          (_: any, i: number) => i !== idx,
                        );
                        setNewItem({ ...newItem, variants: nv });
                      }}
                      className="text-red-500 font-bold px-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              {newItem.category === 'pizza' && (
                <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border dark:border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-slate-400">Crusts</h4>
                    <button
                      type="button"
                      onClick={() =>
                        setNewItem({
                          ...newItem,
                          crusts: [...newItem.crusts, { name: "", price: 0 }],
                        })
                      }
                      className="text-primary-500 text-sm font-bold hover:underline"
                    >
                      + Add Crust
                    </button>
                  </div>
                  {newItem.crusts?.map((c: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Crust (e.g. Cheese Burst)"
                        value={c.name}
                        onChange={(e) => {
                          const nc = [...newItem.crusts];
                          nc[idx].name = e.target.value;
                          setNewItem({ ...newItem, crusts: nc });
                        }}
                        className="flex-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Extra Price (₹)"
                        value={c.price}
                        onChange={(e) => {
                          const nc = [...newItem.crusts];
                          nc[idx].price = Number(e.target.value);
                          setNewItem({ ...newItem, crusts: nc });
                        }}
                        className="w-32 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nc = newItem.crusts.filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setNewItem({ ...newItem, crusts: nc });
                        }}
                        className="text-red-500 font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-slate-400">
                    Extra Toppings
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setNewItem({
                        ...newItem,
                        addons: [...newItem.addons, { name: "", price: 0 }],
                      })
                    }
                    className="text-primary-500 text-sm font-bold hover:underline"
                  >
                    + Add Topping
                  </button>
                </div>
                {newItem.addons?.map((a: any, idx: number) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Topping (e.g. Jalapeno)"
                      value={a.name}
                      onChange={(e) => {
                        const na = [...newItem.addons];
                        na[idx].name = e.target.value;
                        setNewItem({ ...newItem, addons: na });
                      }}
                      className="flex-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Extra Price (₹)"
                      value={a.price}
                      onChange={(e) => {
                        const na = [...newItem.addons];
                        na[idx].price = Number(e.target.value);
                        setNewItem({ ...newItem, addons: na });
                      }}
                      className="w-32 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const na = newItem.addons.filter(
                          (_: any, i: number) => i !== idx,
                        );
                        setNewItem({ ...newItem, addons: na });
                      }}
                      className="text-red-500 font-bold px-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              {/* Interactive DeepSeek V4 Flash Assistant Chatbox */}
              <AIDeepSeekAssistantChatbox
                mode="product-description"
                contextData={{
                  name: newItem.productName,
                  category: newItem.category,
                }}
                onApplyOutput={(output) => {
                  if (output.description) {
                    setNewItem((prev: any) => ({ ...prev, description: output.description }));
                  }
                }}
              />

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-400">Product Description</label>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newItem.productName?.trim()) {
                      toast.error("Please enter a product name first!");
                      return;
                    }
                    setIsGeneratingImage(true);
                    const toastId = toast.loading("Generating description with DeepSeek V4 Flash...");
                    try {
                      const res = await fetch("/api/ai/product-description", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: newItem.productName,
                          category: newItem.category,
                          type: 'product',
                        }),
                      });
                      const data = await res.json();
                      if (data.success && data.description) {
                        setNewItem((prev: any) => ({ ...prev, description: data.description }));
                        toast.success(`✨ Description generated via ${data.model || 'DeepSeek V4 Flash'}!`, { id: toastId });
                      } else {
                        toast.error(data.error || "Failed to generate description", { id: toastId });
                      }
                    } catch (err: any) {
                      toast.error("Generation error: " + err.message, { id: toastId });
                    }
                    setIsGeneratingImage(false);
                  }}
                  disabled={isGeneratingImage}
                  className="px-3 py-1 bg-gradient-to-r from-primary-600 to-amber-600 hover:from-primary-500 hover:to-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Generate AI Description (DeepSeek V4 Flash)</span>
                </button>
              </div>

              <textarea
                placeholder="Final Product Description (Auto-filled by DeepSeek V4 Flash)"
                required
                value={newItem.description}
                onChange={(e) =>
                  setNewItem({ ...newItem, description: e.target.value })
                }
                className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700 h-24"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="md:col-span-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg p-4 disabled:opacity-100"
            >
              {uploading
                ? `Uploading Image... ${uploadProgress}%`
                : "Save Product"}
            </button>
          </form>

          {/* Live Preview Panel */}
          <div className="xl:col-span-1 hidden md:block space-y-4">
            <h3 className="font-bold text-slate-400 uppercase tracking-wider text-sm mb-4">
              Live App Preview
            </h3>
            <div className="max-w-sm mx-auto pointer-events-none">
              <ProductCard
                item={{
                  id: "preview",
                  name: newItem.productName || "Pizza Name",
                  description:
                    newItem.description || "Delicious pizza description...",
                  category: newItem.category,
                  basePrice: newItem.basePrice || 0,
                  image: selectedFile
                    ? URL.createObjectURL(selectedFile)
                    : aiGeneratedImageUrl ||
                      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
                  isVegetarian: newItem.isVegetarian,
                  isAvailable: newItem.isActive,
                  variants: newItem.variants,
                  crusts: newItem.crusts,
                  addons: newItem.addons,
                }}
                discount={0}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && !isAdding && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-[#1E293B] dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-white/10 flex gap-4 items-center group"
          >
            {/* Auto format and lazy loading */}
            <img
              src={item.imageUrl?.replace(
                "/upload/",
                "/upload/w_200,f_auto,q_auto/",
              ) || "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80"}
              loading="lazy"
              alt={item.productName}
              className="w-24 h-24 object-cover rounded-lg bg-slate-100"
            />
            <div className="flex-1">
              <h3 className="font-bold text-lg text-white">
                {item.productName}
              </h3>
              <p className="text-sm text-slate-400 mb-2 line-clamp-1">
                {item.description}
              </p>
              <div className="font-bold text-primary-600">
                ₹{item.basePrice}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setEditingItem(item)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => deleteItem(item)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* EDIT MODAL (Fixed) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-white/10 shadow-2xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-[#1E293B] border border-white/10 shadow-2xl z-10">
              <h2 className="text-2xl font-black">Edit Product</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setSelectedFile(null);
                }}
                className="text-slate-400 hover:text-slate-300 text-3xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={handleEdit}
              className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-slate-400 mb-1 block">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.productName}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      productName: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>

              <div className="md:col-span-2 bg-[#0B0F14] border border-white/5 p-4 rounded-xl border dark:border-slate-700 space-y-4">
                <h4 className="font-bold text-sm text-slate-400">Pricing Configuration</h4>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, pricingMode: 'fixed', discountPercentage: 0 })}
                    className={`flex-1 py-2 rounded-lg font-bold ${editingItem.pricingMode !== 'offer' ? 'bg-primary-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                  >
                    Fixed Price
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, pricingMode: 'offer' })}
                    className={`flex-1 py-2 rounded-lg font-bold ${editingItem.pricingMode === 'offer' ? 'bg-primary-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                  >
                    Offer Price
                  </button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">{editingItem.pricingMode !== 'offer' ? 'Final Price (₹)' : 'Original Price (₹)'}</label>
                    <input
                      type="number"
                      required
                      value={editingItem.basePrice || ""}
                      onChange={(e) => {
                        const basePrice = Number(e.target.value);
                        const offerPrice = editingItem.offerPrice || 0;
                        const discountPercentage = editingItem.pricingMode === 'offer' && offerPrice > 0 && basePrice > offerPrice 
                          ? Math.round(((basePrice - offerPrice) / basePrice) * 100) : 0;
                        setEditingItem({ ...editingItem, basePrice, discountPercentage });
                      }}
                      className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  {editingItem.pricingMode === 'offer' && (
                    <div className="flex-1">
                      <label className="text-xs text-primary-400 mb-1 block font-bold">Offer Price (₹)</label>
                      <input
                        type="number"
                        required
                        value={editingItem.offerPrice || ""}
                        onChange={(e) => {
                          const offerPrice = Number(e.target.value);
                          const basePrice = editingItem.basePrice || 0;
                          const discountPercentage = basePrice > offerPrice 
                            ? Math.round(((basePrice - offerPrice) / basePrice) * 100) : 0;
                          setEditingItem({ ...editingItem, offerPrice, discountPercentage });
                        }}
                        className="w-full p-3 rounded-lg border border-primary-500/50 bg-slate-900 text-primary-100 font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-400 mb-1 block">
                  Category
                </label>
                <select
                  value={editingItem.category}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, category: e.target.value })
                  }
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                >
                  <option value="pizza">Pizza</option>
                  <option value="sides">Sides</option>
                  <option value="beverage">Beverage</option>
                </select>
              </div>

              <div className="md:col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 p-6 rounded-xl flex flex-col items-center justify-center relative">
                {selectedFile ? (
                  <div className="text-center">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="h-32 object-contain mx-auto mb-4 rounded"
                    />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 text-xs mt-2 font-bold hover:underline"
                    >
                      Keep Original Image Instead
                    </button>
                  </div>
                ) : (
                  <>
                    <img
                      src={editingItem.imageUrl}
                      alt="Current"
                      className="h-24 object-contain mx-auto mb-4 rounded opacity-100"
                    />
                    <p className="text-slate-400 font-medium mb-2">
                      Select new image to replace current
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                      className="absolute inset-0 w-full h-full opacity-100 cursor-pointer"
                    />
                  </>
                )}
                {uploading && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-primary-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                )}
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-slate-400">
                      Sizes / Variants
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          variants: [
                            ...(editingItem.variants || []),
                            { name: "", price: 0 },
                          ],
                        })
                      }
                      className="text-primary-500 text-sm font-bold hover:underline"
                    >
                      + Add Size
                    </button>
                  </div>
                  {(editingItem.variants || []).map((v: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Size (e.g. Medium)"
                        value={v.name}
                        onChange={(e) => {
                          const nv = [...editingItem.variants];
                          nv[idx].name = e.target.value;
                          setEditingItem({ ...editingItem, variants: nv });
                        }}
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Extra Price (₹)"
                        value={v.price}
                        onChange={(e) => {
                          const nv = [...editingItem.variants];
                          nv[idx].price = Number(e.target.value);
                          setEditingItem({ ...editingItem, variants: nv });
                        }}
                        className="w-32 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nv = editingItem.variants.filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setEditingItem({ ...editingItem, variants: nv });
                        }}
                        className="text-red-500 font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-slate-400">Crusts</h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          crusts: [
                            ...(editingItem.crusts || []),
                            { name: "", price: 0 },
                          ],
                        })
                      }
                      className="text-primary-500 text-sm font-bold hover:underline"
                    >
                      + Add Crust
                    </button>
                  </div>
                  {(editingItem.crusts || []).map((c: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Crust (e.g. Cheese Burst)"
                        value={c.name}
                        onChange={(e) => {
                          const nc = [...editingItem.crusts];
                          nc[idx].name = e.target.value;
                          setEditingItem({ ...editingItem, crusts: nc });
                        }}
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Extra Price (₹)"
                        value={c.price}
                        onChange={(e) => {
                          const nc = [...editingItem.crusts];
                          nc[idx].price = Number(e.target.value);
                          setEditingItem({ ...editingItem, crusts: nc });
                        }}
                        className="w-32 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nc = editingItem.crusts.filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setEditingItem({ ...editingItem, crusts: nc });
                        }}
                        className="text-red-500 font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-[#0B0F14] border border-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-slate-400">
                      Extra Toppings
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          addons: [
                            ...(editingItem.addons || []),
                            { name: "", price: 0 },
                          ],
                        })
                      }
                      className="text-primary-500 text-sm font-bold hover:underline"
                    >
                      + Add Topping
                    </button>
                  </div>
                  {(editingItem.addons || []).map((a: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Topping (e.g. Jalapeno)"
                        value={a.name}
                        onChange={(e) => {
                          const na = [...editingItem.addons];
                          na[idx].name = e.target.value;
                          setEditingItem({ ...editingItem, addons: na });
                        }}
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Extra Price (₹)"
                        value={a.price}
                        onChange={(e) => {
                          const na = [...editingItem.addons];
                          na[idx].price = Number(e.target.value);
                          setEditingItem({ ...editingItem, addons: na });
                        }}
                        className="w-32 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const na = editingItem.addons.filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setEditingItem({ ...editingItem, addons: na });
                        }}
                        className="text-red-500 font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <label className="text-sm font-bold text-slate-400 mb-1 block">
                  Description
                </label>
                <textarea
                  required
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent h-24"
                />
              </div>

              <div className="md:col-span-2 flex justify-end mt-4">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl px-8 py-3 disabled:opacity-100"
                >
                  {uploading ? `Saving... ${uploadProgress}%` : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

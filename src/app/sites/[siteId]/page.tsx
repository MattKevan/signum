// src/app/sites/[siteId]/posts/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePosts } from '@/hooks/use-posts';
import { useSites } from '@/hooks/use-sites';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/content/markdown-editor';
import { 
  ArrowLeftIcon, 
  EyeIcon, 
  BookmarkIcon,
  RocketLaunchIcon,
  ClockIcon,
  TagIcon,
  
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface PageProps {
  params: { siteId: string };
}

export default function NewPostPage({ params }: PageProps) {
  const router = useRouter();
  const { createPost } = usePosts();
  const { sites } = useSites();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    tags: '',
    allow_likes: true,
    slug: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Get current site info
  const currentSite = sites.find(s => s.id === params.siteId);

  // Auto-generate slug from title
  useEffect(() => {
    if (formData.title && !formData.slug) {
      const generatedSlug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData(prev => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.title, formData.slug]);

  // Auto-save functionality
  useEffect(() => {
    if (!formData.title && !formData.content) return;

    setAutoSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      // In a real app, this would save to IndexedDB or localStorage
      localStorage.setItem(`draft-${params.siteId}`, JSON.stringify(formData));
      setAutoSaveStatus('saved');
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [formData, params.siteId]);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(`draft-${params.siteId}`);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setFormData(draftData);
        setAutoSaveStatus('unsaved');
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [params.siteId]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (saveAsDraft = true) => {
    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const postData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        summary: formData.summary.trim() || generateSummary(formData.content),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        allow_likes: formData.allow_likes,
        slug: formData.slug || generateSlugFromTitle(formData.title),
        draft: saveAsDraft,
      };

      const newPost = await createPost(params.siteId, postData);
      
      // Clear the draft from localStorage
      localStorage.removeItem(`draft-${params.siteId}`);
      
      // Redirect to the new post
      router.push(`/sites/${params.siteId}/posts/${newPost.id}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSummary = (content: string): string => {
    // Remove markdown syntax and get first 150 characters
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    return plainText.length > 150 
      ? plainText.substring(0, 150) + '...'
      : plainText;
  };

  const generateSlugFromTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setAutoSaveStatus('unsaved');
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const isValid = formData.title.trim() && formData.content.trim();

  if (!currentSite) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Site Not Found</h1>
          <p className="text-gray-600 mb-4">The site you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/sites">
            <Button>Back to Sites</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href={`/sites/${params.siteId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to {currentSite.config.title}
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Post</h1>
            <p className="text-gray-600 mt-2">
              Create a new post for your site.
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Auto-save status */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <ClockIcon className="h-4 w-4" />
              <span>
                {autoSaveStatus === 'saved' && 'Draft saved'}
                {autoSaveStatus === 'saving' && 'Saving...'}
                {autoSaveStatus === 'unsaved' && 'Unsaved changes'}
              </span>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-2"
            >
              <EyeIcon className="h-4 w-4" />
              <span>{showPreview ? 'Hide Preview' : 'Preview'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className={`${showPreview ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="space-y-6">
            {/* Post metadata */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.title ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your post title"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                    URL Slug
                  </label>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">
                      {currentSite.config.hosting.canonical_url}/posts/
                    </span>
                    <input
                      type="text"
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleInputChange('slug', e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.slug ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="auto-generated-from-title"
                    />
                  </div>
                  {errors.slug && (
                    <p className="mt-1 text-sm text-red-600">{errors.slug}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Leave empty to auto-generate from title
                  </p>
                </div>
                
                <div>
                  <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
                    Summary
                  </label>
                  <textarea
                    id="summary"
                    rows={2}
                    value={formData.summary}
                    onChange={(e) => handleInputChange('summary', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief summary of your post (optional)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    If left empty, a summary will be generated from your content.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <div className="flex items-center space-x-2">
                    <TagIcon className="h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="technology, tutorial, opinion"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Separate tags with commas
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allow_likes"
                    checked={formData.allow_likes}
                    onChange={(e) => handleInputChange('allow_likes', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allow_likes" className="ml-2 text-sm text-gray-700">
                    Allow likes on this post
                  </label>
                </div>
              </div>
            </div>

            {/* Content editor */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Content *
              </label>
              <MarkdownEditor
                value={formData.content}
                onChange={(value) => handleInputChange('content', value)}
                height="500px"
                className={errors.content ? 'border-red-300' : ''}
              />
              {errors.content && (
                <p className="mt-2 text-sm text-red-600">{errors.content}</p>
              )}
            </div>
          </div>
        </div>

        {/* Preview sidebar */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                
                <div className="space-y-4">
                  {formData.title && (
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        {formData.title}
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  {formData.tags && (
                    <div className="flex flex-wrap gap-1">
                      {formData.tags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {formData.summary && (
                    <p className="text-sm text-gray-600 italic">
                      {formData.summary}
                    </p>
                  )}
                  
                  {formData.content && (
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: formData.content.substring(0, 500) + (formData.content.length > 500 ? '...' : '')
                      }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:pl-64">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="publish_status"
                checked={isDraft}
                onChange={() => setIsDraft(true)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                <BookmarkIcon className="h-4 w-4 mr-1" />
                Save as Draft
              </span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="publish_status"
                checked={!isDraft}
                onChange={() => setIsDraft(false)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                <RocketLaunchIcon className="h-4 w-4 mr-1" />
                Publish Now
              </span>
            </label>
          </div>
          
          <div className="flex space-x-3">
            <Link href={`/sites/${params.siteId}`}>
              <Button variant="outline">Cancel</Button>
            </Link>
            
            <Button 
              onClick={() => handleSubmit(isDraft)}
              disabled={isSubmitting || !isValid}
              className="flex items-center space-x-2"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isDraft ? (
                <BookmarkIcon className="h-4 w-4" />
              ) : (
                <RocketLaunchIcon className="h-4 w-4" />
              )}
              <span>
                {isSubmitting 
                  ? (isDraft ? 'Saving...' : 'Publishing...') 
                  : (isDraft ? 'Save Draft' : 'Publish Post')
                }
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Spacer for fixed action bar */}
      <div className="h-20" />
    </div>
  );
}
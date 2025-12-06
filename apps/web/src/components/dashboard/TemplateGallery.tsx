import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Template {
  id: string;
  name: string;
  description: string;
  category?: string;
  data: any;
}

export const TemplateGallery = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        api.templates.list().then(setTemplates).catch(console.error).finally(() => setLoading(false));
    }, []);

    const handleUseTemplate = async (template: Template) => {
        const name = prompt(`Create new spreadsheet from "${template.name}"? Enter name:`, template.name);
        if (!name) return;

        try {
            const newSheet = await api.spreadsheets.create({
                name,
                data: template.data
            });
            router.push(`/spreadsheet/${newSheet.id}`);
        } catch (err) {
            console.error(err);
            alert('Failed to create spreadsheet from template');
        }
    };

    if (loading) return null;
    if (templates.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Start from a Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {templates.map(tpl => (
                    <div 
                        key={tpl.id}
                        onClick={() => handleUseTemplate(tpl)}
                        className="bg-white border rounded p-4 hover:shadow-md cursor-pointer transition border-t-4 border-t-green-500"
                    >
                        <h3 className="font-bold text-gray-800 truncate">{tpl.name}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tpl.description}</p>
                        <div className="mt-3 text-xs text-blue-600 font-medium">Use Template &rarr;</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

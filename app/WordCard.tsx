'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Volume2, BookOpen, Globe, MessageSquare, Lightbulb, Copy, Check, Bookmark, BookmarkCheck } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface VocabularyData {
  word: string;
  pronunciation: string;
  definitions: string[];
  examples: string[];
  persianTranslations: string[];
}

interface IdiomData {
  idiom: string;
  meaning: string[];
  examples: string[];
  persianTranslations: string[];
}

export default function VocabCard() {
  const [inputWord, setInputWord] = useState('');
  const [mode, setMode] = useState<'vocabulary' | 'idiom'>('vocabulary');
  const [vocabularyData, setVocabularyData] = useState<VocabularyData | null>(null);
  const [idiomData, setIdiomData] = useState<IdiomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSections, setCopiedSections] = useState<{[key: string]: boolean}>({});
  const [savedStatus, setSavedStatus] = useState<{[key: string]: boolean}>({});
  const [saving, setSaving] = useState(false);
  const [checkedWords, setCheckedWords] = useState<Set<string>>(new Set());

  const searchWord = async () => {
    if (!inputWord.trim()) return;

    setLoading(true);
    setError('');
    setVocabularyData(null);
    setIdiomData(null);
    setCheckedWords(new Set()); // Clear checked words for new search
    try {
      const response = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: inputWord.trim(), mode }),
      });
      if (!response.ok) {
        throw new Error('Failed to lookup word');
      }
      const data = await response.json();
      if (mode === 'vocabulary') {
        setVocabularyData(data);
      } else {
        setIdiomData(data);
      }
    } catch (error) {
      console.error('Error looking up word:', error);
      setError('Failed to lookup word. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchWord();
    }
  };

  const playPronunciation = () => {
    if (vocabularyData && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(vocabularyData.word);
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const copySection = async (section: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSections(prev => ({ ...prev, [section]: true }));
      setTimeout(() => {
        setCopiedSections(prev => ({ ...prev, [section]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatPronunciation = () => {
    if (!vocabularyData) return '';
    return vocabularyData.pronunciation;
  };

  const formatDefinitions = () => {
    if (!vocabularyData) return '';
    return vocabularyData.definitions.join('\n');
  };

  const formatExamples = () => {
    if (mode === 'vocabulary') {
      if (!vocabularyData) return '';
      return vocabularyData.examples.join('\n');
    } else {
      if (!idiomData) return '';
      return idiomData.examples.join('\n');
    }
  };

  const formatPersianTranslations = () => {
    if (mode === 'vocabulary') {
      if (!vocabularyData) return '';
      return vocabularyData.persianTranslations.join('\n');
    } else {
      if (!idiomData) return '';
      return idiomData.persianTranslations.join('\n');
    }
  };

  const toPersianNumbers = (num: number): string => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().split('').map(digit => persianDigits[parseInt(digit)]).join('');
  };

  const checkSavedStatus = useCallback(async (word: string) => {
    // Skip if we've already checked this word
    if (checkedWords.has(word)) {
      return;
    }

    try {
      const response = await fetch(`/api/save-word?word=${encodeURIComponent(word)}&mode=${mode}`);
      if (response.ok) {
        const data = await response.json();
        setSavedStatus(prev => ({ ...prev, [word]: data.isSaved }));
        setCheckedWords(prev => new Set(prev).add(word));
      }
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  }, [mode, checkedWords]);

  const saveWord = async () => {
    if (!vocabularyData && !idiomData) return;

    setSaving(true);
    try {
      const data = mode === 'vocabulary' ? {
        word: vocabularyData!.word,
        pronunciation: vocabularyData!.pronunciation,
        definitions: vocabularyData!.definitions,
        examples: vocabularyData!.examples,
        persianTranslations: vocabularyData!.persianTranslations
      } : {
        idiom: idiomData!.idiom,
        meaning: idiomData!.meaning,
        examples: idiomData!.examples,
        persianTranslations: idiomData!.persianTranslations
      };

      const response = await fetch('/api/save-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, data }),
      });

      if (response.ok) {
        const result = await response.json();
        const wordKey = mode === 'vocabulary' ? vocabularyData!.word : idiomData!.idiom;
        setSavedStatus(prev => ({ ...prev, [wordKey]: true }));
        
        // Remove from checked words so it can be re-checked if needed
        setCheckedWords(prev => {
          const newSet = new Set(prev);
          newSet.delete(wordKey);
          return newSet;
        });
        
        // Show success feedback
        setCopiedSections(prev => ({ ...prev, saved: true }));
        setTimeout(() => {
          setCopiedSections(prev => ({ ...prev, saved: false }));
        }, 2000);
      } else {
        throw new Error('Failed to save word');
      }
    } catch (error) {
      console.error('Error saving word:', error);
      setError('Failed to save word. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Check saved status when data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (vocabularyData) {
        checkSavedStatus(vocabularyData.word);
      } else if (idiomData) {
        checkSavedStatus(idiomData.idiom);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [vocabularyData?.word, idiomData?.idiom, checkSavedStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:20px_20px] opacity-30"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EchoLingo
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your AI-powered English to Persian dictionary
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Search Card - Full Width */}
          <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl lg:col-span-2">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Word Lookup</CardTitle>
                  <CardDescription>Enter any English word or idiom to explore</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={(e) => { e.preventDefault(); searchWord(); }}>
                <div className="space-y-4">
                  <RadioGroup
                    value={mode}
                    onValueChange={val => setMode(val as 'vocabulary' | 'idiom')}
                    className="flex flex-row gap-6 mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="vocabulary" id="vocabulary" />
                      <Label htmlFor="vocabulary">Vocabulary</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="idiom" id="idiom" />
                      <Label htmlFor="idiom">Idiom</Label>
                    </div>
                  </RadioGroup>
                  <div className="relative">
                    <Input 
                      id="word" 
                      type="text" 
                      className="h-12 pl-4 pr-16 text-lg bg-white/70 border-gray-200/50 focus:bg-white transition-all"
                      value={inputWord}
                      onChange={(e) => setInputWord(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={loading}
                      placeholder={mode === 'vocabulary' ? "Type a word..." : "Type an idiom..."}
                    />
                    <Button 
                      type="submit"
                      disabled={loading || !inputWord.trim()}
                      className="absolute right-1 top-1 h-10 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                </div>
              </form>

              {/* Quick Suggestions */}

            </CardContent>
          </Card>
        </div>

        {/* Results Cards - 2x2 Grid */}
        {mode === 'vocabulary' && vocabularyData ? (
          <div className="mt-8 grid md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom duration-500">
            {/* Pronunciation Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Volume2 className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Pronunciation</CardTitle>
                      <CardDescription>How to say &ldquo;{vocabularyData.word}&rdquo;</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copySection('vocab-word', vocabularyData.word)}
                      className="h-8 w-8 rounded-lg hover:bg-orange-50"
                      title="Copy word"
                    >
                      {copiedSections['vocab-word'] ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveWord}
                      disabled={saving}
                      className="h-8 w-8 rounded-lg hover:bg-orange-50"
                      title={savedStatus[vocabularyData.word] ? "Already saved" : "Save word"}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
                      ) : savedStatus[vocabularyData.word] ? (
                        <BookmarkCheck className="h-3 w-3 text-green-600" />
                      ) : copiedSections.saved ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Bookmark className="h-3 w-3 text-orange-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 px-4 py-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-mono">
                      {vocabularyData.pronunciation}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={playPronunciation}
                        className="h-8 w-8 rounded-full bg-orange-50 hover:bg-orange-100"
                        title="Play pronunciation"
                      >
                        <Volume2 className="h-4 w-4 text-orange-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copySection('pronunciation', formatPronunciation())}
                        className="h-8 w-8 rounded-full bg-orange-50 hover:bg-orange-100"
                        title="Copy pronunciation"
                      >
                        {copiedSections.pronunciation ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-orange-600" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Definitions Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <BookOpen className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Definitions</CardTitle>
                      <CardDescription>Meanings of &ldquo;{vocabularyData.word}&rdquo;</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('definitions', formatDefinitions())}
                    className="h-8 w-8 rounded-lg hover:bg-green-50"
                    title="Copy definitions"
                  >
                    {copiedSections.definitions ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-green-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vocabularyData.definitions.map((definition, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5 text-xs flex-shrink-0">
                          {index + 1}
                        </Badge>
                        <p className="text-gray-700 leading-relaxed text-sm">{definition}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Examples Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Examples</CardTitle>
                      <CardDescription>Usage in sentences</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('examples', formatExamples())}
                    className="h-8 w-8 rounded-lg hover:bg-purple-50"
                    title="Copy examples"
                  >
                    {copiedSections.examples ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-purple-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vocabularyData.examples.map((example, index) => (
                    <div key={index} className="border-l-4 border-purple-200 pl-3 py-2">
                      <p className="text-gray-700 italic text-sm">&ldquo;{example}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Persian Translation Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Globe className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Persian Translation</CardTitle>
                      <CardDescription style={{ fontFamily: 'Vazirmatn, sans-serif' }}>ترجمه فارسی</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('persian', formatPersianTranslations())}
                    className="h-8 w-8 rounded-lg hover:bg-indigo-50"
                    title="Copy Persian translations"
                  >
                    {copiedSections.persian ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-indigo-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
                             <CardContent className="pt-2">
                 <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
                   <div className="space-y-3 max-h-40 overflow-y-auto" dir="rtl">
                     {vocabularyData.persianTranslations.map((translation, index) => (
                       <div key={index} className="flex items-center gap-3">
                         <div className="bg-indigo-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
                           {toPersianNumbers(index + 1)}
                         </div>
                         <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex-1 text-right">
                           <span className="text-base font-medium text-gray-800" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>{translation}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </CardContent>
            </Card>
          </div>
        ) : mode === 'idiom' && idiomData ? (
          // Idiom cards UI
          <div className="mt-8 grid md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom duration-500">
            {/* Idiom Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl md:col-span-2">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Idiom</CardTitle>
                      <CardDescription>{idiomData.idiom}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copySection('idiom-phrase', idiomData.idiom)}
                      className="h-8 w-8 rounded-lg hover:bg-blue-50"
                      title="Copy idiom phrase"
                    >
                      {copiedSections['idiom-phrase'] ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-blue-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveWord}
                      disabled={saving}
                      className="h-8 w-8 rounded-lg hover:bg-blue-50"
                      title={savedStatus[idiomData.idiom] ? "Already saved" : "Save idiom"}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      ) : savedStatus[idiomData.idiom] ? (
                        <BookmarkCheck className="h-3 w-3 text-green-600" />
                      ) : copiedSections.saved ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Bookmark className="h-3 w-3 text-blue-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
            {/* Meaning Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Meaning</CardTitle>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('idiom-meaning', idiomData.meaning.join('\n'))}
                    className="h-8 w-8 rounded-lg hover:bg-green-50"
                    title="Copy meaning"
                  >
                    {copiedSections['idiom-meaning'] ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-green-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {idiomData.meaning.map((meaning, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5 text-xs flex-shrink-0">
                          {index + 1}
                        </Badge>
                        <p className="text-gray-700 leading-relaxed text-sm">{meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Examples Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Examples</CardTitle>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('idiom-examples', idiomData.examples.join('\n'))}
                    className="h-8 w-8 rounded-lg hover:bg-purple-50"
                    title="Copy examples"
                  >
                    {copiedSections['idiom-examples'] ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-purple-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {idiomData.examples.map((example, index) => (
                    <div key={index} className="border-l-4 border-purple-200 pl-3 py-2">
                      <p className="text-gray-700 italic text-sm">&ldquo;{example}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Persian Translation Card */}
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Globe className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Persian Translation</CardTitle>
                      <CardDescription style={{ fontFamily: 'Vazirmatn, sans-serif' }}>ترجمه فارسی</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySection('idiom-persian', idiomData.persianTranslations.join('\n'))}
                    className="h-8 w-8 rounded-lg hover:bg-indigo-50"
                    title="Copy Persian translations"
                  >
                    {copiedSections['idiom-persian'] ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-indigo-600" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
                  <div className="space-y-3 max-h-40 overflow-y-auto" dir="rtl">
                    {idiomData.persianTranslations.map((translation, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="bg-indigo-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
                          {toPersianNumbers(index + 1)}
                        </div>
                        <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex-1 text-right">
                          <span className="text-base font-medium text-gray-800" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>{translation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Empty State */
          <div className="mt-8">
            <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl border-dashed">
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <Lightbulb className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to learn?</h3>
                    <p className="text-gray-600">Enter an English word or idiom to see its meaning, examples, and Persian translation.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

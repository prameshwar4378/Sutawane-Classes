import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  ChevronDown,
  Check,
  Plus,
  X,
  Tag,
  Sparkles,
  Loader2,
} from 'lucide-react'

export interface ExpenseCategoryItem {
  id: string
  name: string
  isActive?: boolean
  sortOrder?: number
}

interface ExpenseCategoryComboboxProps {
  value: string // categoryId or category name
  categoryName?: string // optional current display name
  onChange: (categoryId: string, categoryName: string) => void
  required?: boolean
  className?: string
  placeholder?: string
  disabled?: boolean
}

export const ExpenseCategoryCombobox: React.FC<ExpenseCategoryComboboxProps> = ({
  value,
  categoryName: initialCategoryName,
  onChange,
  required = false,
  className = '',
  placeholder = 'Select or type a category...',
  disabled = false,
}) => {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Fetch all active categories
  const { data: categories = [], isLoading } = useQuery<ExpenseCategoryItem[]>({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories'),
  })

  // Determine current selected category from ID or name
  const selectedCategory = useMemo(() => {
    if (!value && !initialCategoryName) return null
    return (
      categories.find(
        (c) =>
          c.id === value ||
          c.name.toLowerCase() === (initialCategoryName || value).toLowerCase()
      ) || null
    )
  }, [categories, value, initialCategoryName])

  // Synchronize input text with selected category when not actively searching
  useEffect(() => {
    if (!isOpen) {
      if (selectedCategory) {
        setSearchQuery(selectedCategory.name)
      } else if (initialCategoryName) {
        setSearchQuery(initialCategoryName)
      } else if (value && !categories.some((c) => c.id === value)) {
        // If value was passed as a custom name
        setSearchQuery(value)
      } else {
        setSearchQuery('')
      }
    }
  }, [selectedCategory, initialCategoryName, value, isOpen, categories])

  // Create new category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post('/expenses/categories', { name }),
    onSuccess: (newCat: ExpenseCategoryItem) => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
      onChange(newCat.id, newCat.name)
      setSearchQuery(newCat.name)
      setIsOpen(false)
    },
  })

  // Filter existing categories based on searchQuery
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return categories

    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, searchQuery])

  // Check if current search query already matches an existing category
  const exactMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return categories.find((c) => c.name.toLowerCase() === q) || null
  }, [categories, searchQuery])

  // Determine if we should show the "Create New" option
  const canCreateNew = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return false
    return !exactMatch
  }, [searchQuery, exactMatch])

  // Total items in list (filtered categories + 1 if canCreateNew)
  const totalItemsCount = filteredCategories.length + (canCreateNew ? 1 : 0)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        // If user typed something and closed without selecting:
        if (searchQuery.trim()) {
          const match = categories.find(
            (c) => c.name.toLowerCase() === searchQuery.trim().toLowerCase()
          )
          if (match) {
            onChange(match.id, match.name)
            setSearchQuery(match.name)
          } else {
            // Keep the custom typed name so parent form knows it's a new category to create
            onChange('', searchQuery.trim())
          }
        } else if (!required) {
          onChange('', '')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchQuery, categories, required, onChange])

  // Handle item selection
  const handleSelectCategory = (cat: ExpenseCategoryItem) => {
    onChange(cat.id, cat.name)
    setSearchQuery(cat.name)
    setIsOpen(false)
  }

  // Handle creation of new category
  const handleCreateNew = (nameToCreate?: string) => {
    const name = (nameToCreate || searchQuery).trim()
    if (!name) return

    // Double check if it already exists case-insensitively
    const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (match) {
      handleSelectCategory(match)
      return
    }

    createCategoryMutation.mutate(name)
  }

  // Handle Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
        return
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < totalItemsCount - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItemsCount - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredCategories.length) {
        handleSelectCategory(filteredCategories[highlightedIndex])
      } else if (canCreateNew && (highlightedIndex === filteredCategories.length || filteredCategories.length === 0)) {
        handleCreateNew()
      } else if (filteredCategories.length === 1 && !canCreateNew) {
        handleSelectCategory(filteredCategories[0])
      } else if (canCreateNew) {
        handleCreateNew()
      } else {
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSearchQuery('')
    onChange('', '')
    setIsOpen(true)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Combobox Input Field */}
      <div className="relative flex items-center">
        <Tag className="w-3.5 h-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
        
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onChange={(e) => {
            const text = e.target.value
            setSearchQuery(text)
            setIsOpen(true)
            setHighlightedIndex(-1)

            // Real-time matching: if typed text matches an existing category exactly, bind to it
            const match = categories.find((c) => c.name.toLowerCase() === text.trim().toLowerCase())
            if (match) {
              onChange(match.id, match.name)
            } else {
              // Mark as new custom category name
              onChange('', text.trim())
            }
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-16 h-9 text-xs font-medium bg-background border-input focus:border-primary"
        />

        {/* Action icons on right */}
        <div className="absolute right-2 flex items-center gap-1">
          {createCategoryMutation.isPending && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          )}

          {searchQuery && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev)
              inputRef.current?.focus()
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Toggle categories list"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Suggestions Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          <div className="p-1.5 max-h-60 overflow-y-auto space-y-0.5 text-xs">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading categories...
              </div>
            ) : (
              <>
                {/* 1. Quick Create Option at top if user typed something new */}
                {canCreateNew && (
                  <div
                    onClick={() => handleCreateNew()}
                    onMouseEnter={() => setHighlightedIndex(filteredCategories.length)}
                    className={`p-2.5 rounded-lg border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 cursor-pointer flex items-center justify-between transition-all ${
                      highlightedIndex === filteredCategories.length ? 'ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/60' : 'hover:bg-emerald-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Plus className="w-3 h-3" />
                      </div>
                      <div className="truncate">
                        <span className="text-[11px] font-medium opacity-80 block">Create new category:</span>
                        <strong className="text-xs font-bold text-emerald-900 dark:text-emerald-100">"{searchQuery.trim()}"</strong>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
                      Auto-Create
                    </Badge>
                  </div>
                )}

                {/* 2. Existing Suggestions */}
                {filteredCategories.length > 0 ? (
                  <div className="space-y-0.5 pt-0.5">
                    {canCreateNew && (
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Existing Suggestions
                      </div>
                    )}
                    {filteredCategories.map((cat, index) => {
                      const isSelected = selectedCategory?.id === cat.id
                      const isHighlighted = highlightedIndex === index

                      return (
                        <div
                          key={cat.id}
                          onClick={() => handleSelectCategory(cat)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : isHighlighted
                              ? 'bg-muted text-foreground'
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Tag className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="truncate">{cat.name}</span>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  !canCreateNew && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No categories found
                    </div>
                  )
                )}
              </>
            )}
          </div>

          {/* Popover Footer Info */}
          <div className="px-3 py-1.5 bg-muted/40 border-t flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Type to search or add a new category</span>
            <span className="font-mono text-[9px]">{categories.length} available</span>
          </div>
        </div>
      )}
    </div>
  )
}

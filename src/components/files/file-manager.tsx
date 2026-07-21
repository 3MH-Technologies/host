'use client'

import { useState, useCallback, useRef } from 'react'
import { useFiles, useUploadFiles, useCreateDirectory, useDeleteFile, useWriteFile, useRenameFile } from '@/hooks/use-api'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  FolderOpen, File, FileText, FileCode, FileArchive, Image, Upload,
  FolderPlus, Plus, Search, Trash2, Download, Pencil, ChevronRight,
  X, Save, ArrowUp, RefreshCw,
} from 'lucide-react'
import type { FileEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return File
  if (['py', 'js', 'ts', 'jsx', 'tsx', 'rb', 'go', 'rs'].includes(ext)) return FileCode
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'csv'].includes(ext)) return FileText
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return Image
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive
  if (['md', 'txt', 'log', 'cfg', 'ini', 'env'].includes(ext)) return FileText
  if (['php'].includes(ext)) return FileCode
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  appId: string
}

export function FileManager({ appId }: Props) {
  const [currentPath, setCurrentPath] = useState('/')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletePath, setDeletePath] = useState<string | null>(null)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [mkdirName, setMkdirName] = useState('')
  const [editFile, setEditFile] = useState<{ path: string; content: string } | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [renamePath, setRenamePath] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, refetch } = useFiles(appId, currentPath)
  const uploadFiles = useUploadFiles(appId)
  const createDir = useCreateDirectory(appId)
  const deleteFile = useDeleteFile(appId)
  const writeFile = useWriteFile(appId)
  const renameFile = useRenameFile(appId)

  const entries: FileEntry[] = (data?.data || []).filter((e) =>
    !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const dirs = entries.filter((e) => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))
  const files = entries.filter((e) => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))
  const sorted = [...dirs, ...files]

  const breadcrumbs = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean)
  const navigateTo = (path: string) => setCurrentPath(path)
  const navigateUp = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath('/' + parts.join('/') || '/')
  }

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`)
    } else {
      const filePath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
      fetchFileContent(filePath)
    }
  }

  const fetchFileContent = async (path: string) => {
    try {
      const res = await fetch(`/api/apps/${appId}/files/read?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Failed to read file')
      const data = await res.json()
      if (data.data?.content != null) {
        setEditFile({ path, content: data.data.content })
      }
    } catch {
      toast.error('Failed to read file')
    }
  }

  const handleSaveFile = () => {
    if (!editFile) return
    writeFile.mutate({ path: editFile.path, content: editFile.content }, {
      onSuccess: () => setEditFile(null),
    })
  }

  const handleCreateDir = () => {
    if (!mkdirName.trim()) return
    createDir.mutate({ path: currentPath, name: mkdirName.trim() }, {
      onSuccess: () => { setMkdirOpen(false); setMkdirName('') },
    })
  }

  const handleCreateFile = () => {
    if (!newFileName.trim()) return
    const path = currentPath === '/' ? `/${newFileName.trim()}` : `${currentPath}/${newFileName.trim()}`
    writeFile.mutate({ path, content: '' }, {
      onSuccess: () => { setNewFileOpen(false); setNewFileName('') },
    })
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      uploadFiles.mutate({ files, path: currentPath }, {
        onSuccess: () => { refetch(); toast.success(`${files.length} file(s) uploaded`) },
      })
    }
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFiles.mutate({ files, path: currentPath })
    }
  }, [currentPath, uploadFiles])

  const handleDelete = () => {
    if (!deletePath) return
    deleteFile.mutate(deletePath, {
      onSuccess: () => setDeletePath(null),
    })
  }

  const handleRename = () => {
    if (!renamePath || !renameName.trim()) return
    const dir = renamePath.substring(0, renamePath.lastIndexOf('/')) || '/'
    const newPath = dir === '/' ? `/${renameName.trim()}` : `${dir}/${renameName.trim()}`
    renameFile.mutate({ oldPath: renamePath, newPath }, {
      onSuccess: () => setRenamePath(null),
    })
  }

  const handleDownload = (entry: FileEntry) => {
    const path = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
    window.open(`/api/apps/${appId}/files/download?path=${encodeURIComponent(path)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMkdirOpen(true)}>
            <FolderPlus className="h-3.5 w-3.5" /> Folder
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewFileOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> File
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm overflow-x-auto">
        <button onClick={() => navigateTo('/')} className="text-muted-foreground hover:text-foreground shrink-0 font-medium">root</button>
        {breadcrumbs.map((part, i) => (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => navigateTo('/' + breadcrumbs.slice(0, i + 1).join('/'))}
              className="text-muted-foreground hover:text-foreground"
            >
              {part}
            </button>
          </div>
        ))}
        {currentPath !== '/' && (
          <button onClick={navigateUp} className="ml-2 text-muted-foreground hover:text-foreground shrink-0">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* File list */}
      <div
        className="border rounded-lg overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Empty directory" description="Upload files or create a new file/folder." />
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {sorted.map((entry) => {
              const Icon = entry.isDirectory ? FolderOpen : getFileIcon(entry.name)
              return (
                <div
                  key={entry.path}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 text-sm group"
                  onDoubleClick={() => handleDoubleClick(entry)}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', entry.isDirectory ? 'text-amber-400' : 'text-muted-foreground')} />
                  <span className="flex-1 truncate font-medium">{entry.name}</span>
                  {!entry.isDirectory && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatSize(entry.size)}</span>
                  )}
                  <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
                    {new Date(entry.modifiedAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!entry.isDirectory && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDownload(entry) }}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); const p = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`; fetchFileContent(p) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        const p = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
                        setRenamePath(p)
                        setRenameName(entry.name)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        const p = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
                        setDeletePath(p)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit File Dialog */}
      <Dialog open={!!editFile} onOpenChange={(open) => !open && setEditFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{editFile?.path}</DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full h-96 bg-zinc-950 text-zinc-200 rounded-lg p-4 font-mono text-sm resize-none outline-none border focus:border-emerald-500/50"
            value={editFile?.content || ''}
            onChange={(e) => setEditFile((prev) => prev ? { ...prev, content: e.target.value } : null)}
            spellCheck={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFile(null)}>Cancel</Button>
            <Button onClick={handleSaveFile} disabled={writeFile.isPending} className="gap-1.5">
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mkdir Dialog */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Directory</DialogTitle></DialogHeader>
          <Input placeholder="folder-name" value={mkdirName} onChange={(e) => setMkdirName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateDir()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMkdirOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDir} disabled={createDir.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create File</DialogTitle></DialogHeader>
          <Input placeholder="filename.txt" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFile} disabled={writeFile.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renamePath} onOpenChange={(open) => !open && setRenamePath(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamePath(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameFile.isPending}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletePath}
        onOpenChange={(open) => !open && setDeletePath(null)}
        title="Delete"
        description={`Delete "${deletePath?.split('/').pop()}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
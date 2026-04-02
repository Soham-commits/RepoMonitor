"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { LogOut, Upload, FileSpreadsheet, Loader2, ExternalLink, Search, Filter, ArrowUpDown, Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { VideoBackground } from "@/components/ui/video-background"

interface Team {
  teamId: string
  teamName: string
  psId: string
  repoLink: string
}

interface TeamCommitState {
  status: "idle" | "loading" | "ready" | "private" | "rate_limited"
  firstCommit: string | null
  lastCommit: string | null
  totalCommits: number | null
}

interface CommitApiItem {
  commit?: {
    author?: { date?: string }
    committer?: { date?: string }
  }
}

interface CommitStats {
  totalCommits: number
  firstCommit: string | null
  lastCommit: string | null
}

interface ParsedTeamResult {
  teams: Team[]
  hasRequiredColumns: boolean
}

type AdminSortKey = "Team Name" | "Team ID" | "PS ID" | "Total Commits"
type AdminCombinedFilter = "All" | "Has Commits" | "No Commits" | `PS:${string}`

const REQUIRED_COLUMN_ERROR = "Could not detect required columns. Check your file format"
const COMMIT_SINCE = "2026-04-02T08:30:00Z"
const COMMIT_UNTIL = "2026-04-04T18:29:00Z"

const formatCommitTime = (iso: string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

const getTeamKey = (team: Team) => `${team.psId}::${team.teamId}::${team.repoLink}`

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const extractOwnerRepo = (repoLink: string): { owner: string; repo: string } | null => {
  const trimmed = repoLink.trim().replace(/\.git$/i, "")

  if (!trimmed) return null

  const parsePath = (pathValue: string) => {
    const parts = pathValue.split("/").filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1] }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (!url.hostname.toLowerCase().includes("github.com")) return null
      return parsePath(url.pathname)
    } catch {
      return null
    }
  }

  if (/^github\.com\//i.test(trimmed)) {
    return parsePath(trimmed.replace(/^github\.com\//i, ""))
  }

  return parsePath(trimmed)
}

const buildCommitEndpoint = (owner: string, repo: string, params: Record<string, string | number>) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value))
  })
  return `https://api.github.com/repos/${owner}/${repo}/commits?${query.toString()}`
}

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "").replace(/-/g, "")

const findHeaderKey = (headers: string[], aliases: string[]) => {
  const aliasSet = new Set(aliases.map((a) => normalizeHeader(a)))
  return headers.find((header) => aliasSet.has(normalizeHeader(header)))
}

const parseTeamsFromRows = (rows: Record<string, unknown>[]): ParsedTeamResult => {
  if (!rows.length) {
    return { teams: [], hasRequiredColumns: false }
  }

  const headers = Object.keys(rows[0])
  const teamIdKey = findHeaderKey(headers, ["Team ID", "team_id", "teamid"])
  const teamNameKey = findHeaderKey(headers, ["Team Name", "team_name", "teamname"])
  const psIdKey = findHeaderKey(headers, ["PS ID", "ps_id", "psid"])
  const repoLinkKey = findHeaderKey(headers, ["GitHub Repo Link", "github_repo", "repo", "repo_link"])

  if (!teamIdKey || !teamNameKey || !psIdKey || !repoLinkKey) {
    return { teams: [], hasRequiredColumns: false }
  }

  const teams = rows
    .map((row) => ({
      teamId: String(row[teamIdKey] ?? "").trim(),
      teamName: String(row[teamNameKey] ?? "").trim(),
      psId: String(row[psIdKey] ?? "").trim(),
      repoLink: String(row[repoLinkKey] ?? "").trim(),
    }))
    .filter((team) => team.teamId && team.teamName && team.psId && team.repoLink)

  return { teams, hasRequiredColumns: true }
}

const sanitizeTeamsPayload = (value: unknown): Team[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null

      const team = item as Partial<Team>
      const teamId = typeof team.teamId === "string" ? team.teamId.trim() : ""
      const teamName = typeof team.teamName === "string" ? team.teamName.trim() : ""
      const psId = typeof team.psId === "string" ? team.psId.trim() : ""
      const repoLink = typeof team.repoLink === "string" ? team.repoLink.trim() : ""

      if (!teamId || !teamName || !psId || !repoLink) {
        return null
      }

      return {
        teamId,
        teamName,
        psId,
        repoLink,
      }
    })
    .filter((team): team is Team => Boolean(team))
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importToastMessage, setImportToastMessage] = useState("")
  const [showImportToast, setShowImportToast] = useState(false)
  const [isFetchingCommitData, setIsFetchingCommitData] = useState(false)
  const [search, setSearch] = useState("")
  const [combinedFilter, setCombinedFilter] = useState<AdminCombinedFilter>("All")
  const [sortKey, setSortKey] = useState<AdminSortKey>("Team Name")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [isImportScreen, setIsImportScreen] = useState(true)
  const [pat, setPat] = useState("")
  const [isPatInputVisible, setIsPatInputVisible] = useState(false)
  const [isSavingPat, setIsSavingPat] = useState(false)
  const [patSaveError, setPatSaveError] = useState("")
  const [rateLimit, setRateLimit] = useState<{ remaining: string; limit: string }>({ remaining: "--", limit: "--" })
  const [teamCommits, setTeamCommits] = useState<Record<string, TeamCommitState>>({})
  const fetchCycleRef = useRef(0)
  const importToastTimeoutRef = useRef<number | null>(null)

  const showImportSuccessToast = (message: string) => {
    if (importToastTimeoutRef.current) {
      window.clearTimeout(importToastTimeoutRef.current)
    }

    setImportToastMessage(message)
    setShowImportToast(true)

    importToastTimeoutRef.current = window.setTimeout(() => {
      setShowImportToast(false)
      importToastTimeoutRef.current = null
    }, 4000)
  }

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })

        if (!response.ok) {
          router.replace("/login")
          return
        }

        const payload = (await response.json()) as {
          username: string
          role: "admin" | "tech" | "both"
        }

        if (payload.role === "tech") {
          router.replace("/dashboard")
          return
        }

        const [patResponse, teamsResponse] = await Promise.all([
          fetch("/api/pat", { cache: "no-store" }),
          fetch("/api/teams", { cache: "no-store" }),
        ])

        if (patResponse.status === 401 || teamsResponse.status === 401) {
          router.replace("/login")
          return
        }

        const patPayload = patResponse.ok
          ? ((await patResponse.json()) as { pat?: string | null })
          : { pat: null }

        const teamsPayload = teamsResponse.ok
          ? ((await teamsResponse.json()) as { teams?: unknown })
          : { teams: [] }

        const persistedPat = typeof patPayload.pat === "string" ? patPayload.pat.trim() : ""
        setPat(persistedPat)
        setIsPatInputVisible(!persistedPat)

        const persistedTeams = sanitizeTeamsPayload(teamsPayload.teams)
        setTeams(persistedTeams)
        setIsImportScreen(persistedTeams.length === 0)

        if (persistedTeams.length > 0) {
          setImportError("")
        }

        setIsAuthenticated(true)
      } catch {
        router.replace("/login")
      }
    }

    void verifySession()
  }, [router])

  useEffect(() => {
    return () => {
      if (importToastTimeoutRef.current) {
        window.clearTimeout(importToastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileNavOpen)
    return () => document.body.classList.remove("menu-open")
  }, [mobileNavOpen])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
    }
  }

  const handleSavePat = async () => {
    setPatSaveError("")
    setIsSavingPat(true)

    try {
      const trimmedPat = pat.trim()
      const response = await fetch("/api/pat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pat: trimmedPat }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login")
          return
        }
        throw new Error("Failed to save PAT")
      }

      setPat(trimmedPat)
      setIsPatInputVisible(trimmedPat.length === 0)
    } catch {
      setPatSaveError("Unable to save PAT. Please try again.")
    } finally {
      setIsSavingPat(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const parseCsvFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      })
    })
  }

  const parseExcelFile = async (file: File): Promise<Record<string, unknown>[]> => {
    const XLSX = await import("xlsx")
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      return []
    }

    const sheet = workbook.Sheets[firstSheetName]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  }

  const fetchCommitStats = async (
    owner: string,
    repo: string,
    token: string,
    extraParams: Record<string, string>
  ): Promise<{ kind: "ok"; stats: CommitStats } | { kind: "private" } | { kind: "rate_limited" }> => {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
    }

    if (token.trim()) {
      headers.Authorization = `token ${token.trim()}`
    }

    const endpoint = buildCommitEndpoint(owner, repo, {
      ...extraParams,
      per_page: 100,
    })

    const response = await fetch(endpoint, { headers })

    const remaining = response.headers.get("x-ratelimit-remaining")
    const limit = response.headers.get("x-ratelimit-limit")
    if (remaining && limit) {
      setRateLimit({ remaining, limit })
    }

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining")
      if (response.status === 403 && remaining === "0") {
        return { kind: "rate_limited" }
      }
      if (response.status === 401 || response.status === 404) {
        return { kind: "private" }
      }
      if (response.status === 403) {
        return { kind: "private" }
      }
      return {
        kind: "ok",
        stats: { totalCommits: 0, firstCommit: null, lastCommit: null },
      }
    }

    const commits = (await response.json()) as CommitApiItem[]
    const commitDates = commits
      .map((item) => item.commit?.author?.date || item.commit?.committer?.date)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    const firstDate = commitDates.length > 0 ? commitDates[0] : null
    const lastDate = commitDates.length > 0 ? commitDates[commitDates.length - 1] : null

    return {
      kind: "ok",
      stats: {
        totalCommits: commits.length,
        firstCommit: firstDate,
        lastCommit: lastDate,
      },
    }
  }

  const updateTeamCommit = (team: Team, next: TeamCommitState) => {
    const key = getTeamKey(team)
    setTeamCommits((prev) => ({
      ...prev,
      [key]: next,
    }))
  }

  const fetchRepoCommits = async (team: Team, token: string, cycleId: number) => {
    const parsedRepo = extractOwnerRepo(team.repoLink)
    if (!parsedRepo) {
      if (fetchCycleRef.current !== cycleId) return
      updateTeamCommit(team, {
        status: "private",
        firstCommit: null,
        lastCommit: null,
        totalCommits: null,
      })
      return
    }

    try {
      const windowResult = await fetchCommitStats(parsedRepo.owner, parsedRepo.repo, token, {
        since: COMMIT_SINCE,
        until: COMMIT_UNTIL,
      })

      if (fetchCycleRef.current !== cycleId) return

      if (windowResult.kind === "private") {
        updateTeamCommit(team, {
          status: "private",
          firstCommit: null,
          lastCommit: null,
          totalCommits: null,
        })
        return
      }

      if (windowResult.kind === "rate_limited") {
        updateTeamCommit(team, {
          status: "rate_limited",
          firstCommit: null,
          lastCommit: null,
          totalCommits: null,
        })
        return
      }

      if (windowResult.stats.totalCommits === 0) {
        const fallbackResult = await fetchCommitStats(parsedRepo.owner, parsedRepo.repo, token, {})

        if (fetchCycleRef.current !== cycleId) return

        if (fallbackResult.kind === "private") {
          updateTeamCommit(team, {
            status: "private",
            firstCommit: null,
            lastCommit: null,
            totalCommits: null,
          })
          return
        }

        if (fallbackResult.kind === "rate_limited") {
          updateTeamCommit(team, {
            status: "rate_limited",
            firstCommit: null,
            lastCommit: null,
            totalCommits: null,
          })
          return
        }

        updateTeamCommit(team, {
          status: "ready",
          firstCommit: fallbackResult.stats.firstCommit ? formatCommitTime(fallbackResult.stats.firstCommit) : null,
          lastCommit: fallbackResult.stats.lastCommit ? formatCommitTime(fallbackResult.stats.lastCommit) : null,
          totalCommits: fallbackResult.stats.totalCommits,
        })
        return
      }

      updateTeamCommit(team, {
        status: "ready",
        firstCommit: windowResult.stats.firstCommit ? formatCommitTime(windowResult.stats.firstCommit) : null,
        lastCommit: windowResult.stats.lastCommit ? formatCommitTime(windowResult.stats.lastCommit) : null,
        totalCommits: windowResult.stats.totalCommits,
      })
    } catch {
      if (fetchCycleRef.current !== cycleId) return
      updateTeamCommit(team, {
        status: "private",
        firstCommit: null,
        lastCommit: null,
        totalCommits: null,
      })
    }
  }

  const hydrateCommitData = async (importedTeams: Team[], token: string) => {
    const cycleId = fetchCycleRef.current + 1
    fetchCycleRef.current = cycleId

    const initialState = importedTeams.reduce<Record<string, TeamCommitState>>((acc, team) => {
      acc[getTeamKey(team)] = {
        status: "loading",
        firstCommit: null,
        lastCommit: null,
        totalCommits: null,
      }
      return acc
    }, {})
    setTeamCommits(initialState)

    for (let i = 0; i < importedTeams.length; i += 10) {
      if (fetchCycleRef.current !== cycleId) return

      const batch = importedTeams.slice(i, i + 10)
      await Promise.all(batch.map((team) => fetchRepoCommits(team, token, cycleId)))

      if (i + 10 < importedTeams.length) {
        await delay(300)
      }
    }
  }

  const fetchAllCommitData = async (importedTeams: Team[], token: string) => {
    console.log("Fetching commits for", importedTeams.length, "teams")
    setIsFetchingCommitData(true)
    try {
      await hydrateCommitData(importedTeams, token)
    } finally {
      setIsFetchingCommitData(false)
    }
  }

  const handleImport = async (file: File) => {
    const fileName = file.name.toLowerCase()
    const isCsv = fileName.endsWith(".csv")
    const isXlsx = fileName.endsWith(".xlsx")

    if (!isCsv && !isXlsx) {
      setImportError("Only .xlsx or .csv files supported")
      return
    }

    setIsImporting(true)
    setImportError("")

    try {
      const rows = isCsv ? await parseCsvFile(file) : await parseExcelFile(file)
      const parsed = parseTeamsFromRows(rows)

      if (!parsed.hasRequiredColumns) {
        setImportError(REQUIRED_COLUMN_ERROR)
        return
      }

      const saveResponse = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teams: parsed.teams }),
      })

      if (!saveResponse.ok) {
        if (saveResponse.status === 401) {
          router.replace("/login")
          return
        }
        throw new Error("SAVE_TEAMS_FAILED")
      }

      setIsImportScreen(false)
      if (pat.trim()) {
        setIsPatInputVisible(false)
      }
      setImportError("")
      setTeams(parsed.teams)
      const psCount = new Set(parsed.teams.map((team) => team.psId)).size
      showImportSuccessToast(`${parsed.teams.length} teams imported across ${psCount} problem statements`)
    } catch (error) {
      if (error instanceof Error && error.message === "SAVE_TEAMS_FAILED") {
        setImportError("Could not save team data. Please try again")
      } else {
        setImportError(REQUIRED_COLUMN_ERROR)
      }
    } finally {
      setIsImporting(false)
      setIsDragging(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    if (teams.length === 0) {
      setIsFetchingCommitData(false)
      return
    }
    const token = pat.trim()
    if (!token) return
    void fetchAllCommitData(teams, token)
  }, [teams, pat, isAuthenticated])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return
    void handleImport(droppedFile)
  }

  const groupedTeams = useMemo(() => {
    return teams.reduce<Record<string, Team[]>>((acc, team) => {
      if (!acc[team.psId]) {
        acc[team.psId] = []
      }
      acc[team.psId].push(team)
      return acc
    }, {})
  }, [teams])

  const getCommitCount = (team: Team) => teamCommits[getTeamKey(team)]?.totalCommits

  const hasCommits = (team: Team) => {
    const commitCount = getCommitCount(team)
    return typeof commitCount === "number" && commitCount > 0
  }

  const hasNoCommits = (team: Team) => {
    const commitCount = getCommitCount(team)
    return commitCount === 0
  }

  const matchesCombinedFilter = (team: Team, psId: string) => {
    if (combinedFilter === "All") return true
    if (combinedFilter === "Has Commits") return hasCommits(team)
    if (combinedFilter === "No Commits") return hasNoCommits(team)
    if (combinedFilter.startsWith("PS:")) {
      return psId === combinedFilter.slice(3)
    }
    return true
  }

  const filteredGroupedTeams = useMemo(() => {
    const query = search.trim().toLowerCase()

    const result: Record<string, Team[]> = {}
    Object.entries(groupedTeams).forEach(([psId, psTeams]) => {
      const filtered = psTeams
        .filter((team) => {
          const matchesSearch = !query || (
          team.teamId.toLowerCase().includes(query) ||
          team.teamName.toLowerCase().includes(query) ||
          team.psId.toLowerCase().includes(query) ||
          team.repoLink.toLowerCase().includes(query)
          )

          if (!matchesSearch) return false
          return matchesCombinedFilter(team, psId)
        })
        .sort((a, b) => {
          if (sortKey === "Team Name") return a.teamName.localeCompare(b.teamName)
          if (sortKey === "Team ID") return a.teamId.localeCompare(b.teamId)
          if (sortKey === "PS ID") return a.psId.localeCompare(b.psId)

          const aCount = teamCommits[getTeamKey(a)]?.totalCommits ?? -1
          const bCount = teamCommits[getTeamKey(b)]?.totalCommits ?? -1
          return bCount - aCount
        })

      if (filtered.length) {
        result[psId] = filtered
      }
    })

    return result
  }, [groupedTeams, search, combinedFilter, sortKey, teamCommits])

  const availablePsIds = useMemo(() => {
    return Object.keys(groupedTeams).sort((a, b) => a.localeCompare(b))
  }, [groupedTeams])

  const hasSavedPat = pat.trim().length > 0
  const shouldShowPatInput = isPatInputVisible || !hasSavedPat
  const maskedPat = hasSavedPat ? `${pat.trim().slice(0, 4)}${"•".repeat(10)}` : ""

  const handleLoadNewData = () => {
    setIsImportScreen(true)
    setIsPatInputVisible(false)
    setPatSaveError("")
    setImportError("")
    setIsDragging(false)
  }

  const handleBackToDashboard = () => {
    if (teams.length === 0) return
    setIsImportScreen(false)
    setIsPatInputVisible(false)
    setPatSaveError("")
    setImportError("")
    setIsDragging(false)
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#02020A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1E2CFF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-[#02020A] flex flex-col font-sans overflow-x-hidden">
      <VideoBackground />

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50"
          >
            <button
              type="button"
              aria-label="Close admin mobile menu"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute right-3 top-3 bottom-3 h-auto w-[82%] max-w-sm rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg p-5"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold uppercase tracking-wide text-white">Admin Menu</h2>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {pat ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white/70 font-mono uppercase tracking-wider shadow-lg">
                    API: {rateLimit.remaining} / {rateLimit.limit}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-yellow-300/20 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300 font-medium uppercase tracking-wider">
                    API: No PAT
                  </div>
                )}

                {teams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleLoadNewData()
                      setMobileNavOpen(false)
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white text-sm font-medium"
                  >
                    Import New Data
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-3 z-30 px-3 sm:px-4 md:px-6">
        <div className="max-w-7xl mx-auto rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg px-4 md:px-6 py-3.5 md:py-4 flex items-center gap-3">
          <span className="text-base sm:text-lg md:text-xl font-black text-white tracking-tighter uppercase">Ignisia 2026 — Admin</span>

          <div className="ml-auto hidden md:flex items-center gap-3">
            {pat ? (
              <span className="text-[11px] text-white/70 font-medium">API: {rateLimit.remaining} / {rateLimit.limit}</span>
            ) : (
              <span className="text-[11px] text-yellow-300 font-medium">API: No PAT</span>
            )}
            {teams.length > 0 && (
              <button
                type="button"
                onClick={handleLoadNewData}
                className="px-5 py-2 rounded-full bg-transparent text-white/70 text-xs font-medium hover:bg-white/15 hover:text-white transition-all duration-300 ease-in-out whitespace-nowrap"
              >
                Import New Data
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-6 py-2 rounded-full bg-transparent text-white/70 text-xs font-medium hover:bg-white/15 hover:text-white transition-all duration-300 ease-in-out flex items-center gap-2 group cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Sign Out
            </button>
          </div>

          <button
            type="button"
            aria-label="Open admin mobile menu"
            onClick={() => setMobileNavOpen(true)}
            className="ml-auto md:hidden h-10 w-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl text-white flex items-center justify-center shadow-lg"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="z-10 flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 pt-4 md:pt-6">
        {isImportScreen ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto space-y-4"
          >
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className={`text-xs md:text-sm px-4 py-2 rounded-xl border border-white/20 transition-all ${
                  teams.length > 0
                    ? "text-white/80 bg-white/10 hover:bg-white/15"
                    : "text-white/40 bg-white/5 cursor-not-allowed"
                }`}
              >
                ← Back to Dashboard
              </button>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg p-4 md:p-5">
              {shouldShowPatInput ? (
                <div>
                  <div className="flex flex-col gap-3">
                    <div className="max-w-lg">
                      <p className="text-white font-semibold text-sm">GitHub Personal Access Token</p>
                      <p className="text-white/50 text-xs mt-1">Saved to MongoDB for your account and reused on next login.</p>
                    </div>

                    <div className="w-full flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        placeholder="ghp_..."
                        value={pat}
                        onChange={(e) => {
                          setPat(e.target.value)
                          setPatSaveError("")
                        }}
                        className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleSavePat()
                        }}
                        disabled={isSavingPat}
                        className="px-5 py-3 rounded-xl bg-white/12 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSavingPat ? "Saving..." : "Save PAT"}
                      </button>
                    </div>
                  </div>

                  {patSaveError && <p className="mt-2 text-xs text-red-300">{patSaveError}</p>}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-white/55 text-xs uppercase tracking-wider">Current PAT</p>
                    <p className="text-white/85 text-sm font-mono mt-1">{maskedPat}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPatInputVisible(true)
                      setPatSaveError("")
                    }}
                    className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white/12 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all"
                  >
                    Change PAT
                  </button>
                </div>
              )}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative p-8 md:p-12 rounded-[2.5rem] bg-white/10 backdrop-blur-xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col items-center text-center gap-6 group ${
                isDragging ? "border-white/30 bg-white/8 scale-[1.02]" : "border-white/15 hover:border-white/30"
              }`}
            >
              <div className="w-20 h-20 rounded-3xl bg-[#1E2CFF]/20 border border-[#1E2CFF]/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Upload className={`w-10 h-10 text-[#1E2CFF] ${isDragging ? "animate-bounce" : ""}`} />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Import Team Data</h2>
                <p className="text-white/45 text-sm max-w-sm mx-auto leading-relaxed">
                  Upload Excel or CSV with Team ID, Team Name, PS ID, GitHub Repo Link
                </p>
              </div>

              <label className="mt-4 relative group cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void handleImport(file)
                    e.currentTarget.value = ""
                  }}
                />
                <div className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-bold text-sm transition-all duration-300 hover:from-[#6A3DFF] hover:to-[#B06CFF] shadow-lg active:scale-95 uppercase tracking-wider min-h-12">
                  {isImporting ? "Importing..." : "Select File"}
                </div>
              </label>

              <div className="absolute top-6 right-6 opacity-10">
                <FileSpreadsheet className="w-16 h-16 text-white" />
              </div>
            </div>

            {importError && <p className="mt-5 text-red-400 text-sm text-center">{importError}</p>}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 md:space-y-8">
            <div className="hidden md:flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/10 border border-white/20 p-4 rounded-2xl backdrop-blur-xl shadow-lg w-full">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search owner/repo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-sm w-full"
                />
              </div>

              <div className="w-px h-8 bg-white/10 hidden md:block" />

              <div className="relative">
                <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  title="Filter"
                  value={combinedFilter}
                  onChange={(e) => setCombinedFilter(e.target.value as AdminCombinedFilter)}
                  className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[150px] cursor-pointer"
                >
                  <option value="All">All Filters</option>
                  <option value="Has Commits">Has Commits</option>
                  <option value="No Commits">No Commits</option>
                  {availablePsIds.map((psId) => (
                    <option key={psId} value={`PS:${psId}`}>{`PS ID: ${psId}`}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <ArrowUpDown className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  title="Sort Options"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as AdminSortKey)}
                  className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[170px] cursor-pointer"
                >
                  <option value="Team Name">Sort: Team Name (A-Z)</option>
                  <option value="Team ID">Sort: Team ID</option>
                  <option value="PS ID">Sort: PS ID</option>
                  <option value="Total Commits">Sort: Total Commits</option>
                </select>
              </div>
            </div>

            <div className="md:hidden rounded-2xl bg-white/10 border border-white/20 p-3 backdrop-blur-xl shadow-lg">
              <button
                type="button"
                onClick={() => setMobileControlsOpen((prev) => !prev)}
                className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-white text-sm font-medium flex items-center justify-between"
              >
                Controls, Search, and Sort
                {mobileControlsOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {mobileControlsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-3 space-y-3"
                  >
                    <div className="relative">
                      <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search owner/repo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-sm"
                      />
                    </div>

                    <div className="relative">
                      <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        title="Filter"
                        value={combinedFilter}
                        onChange={(e) => setCombinedFilter(e.target.value as AdminCombinedFilter)}
                        className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none"
                      >
                        <option value="All">All Filters</option>
                        <option value="Has Commits">Has Commits</option>
                        <option value="No Commits">No Commits</option>
                        {availablePsIds.map((psId) => (
                          <option key={psId} value={`PS:${psId}`}>{`PS ID: ${psId}`}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <ArrowUpDown className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        title="Sort Options"
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as AdminSortKey)}
                        className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none"
                      >
                        <option value="Team Name">Sort: Team Name (A-Z)</option>
                        <option value="Team ID">Sort: Team ID</option>
                        <option value="PS ID">Sort: PS ID</option>
                        <option value="Total Commits">Sort: Total Commits</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-6 md:space-y-8">
              {Object.entries(filteredGroupedTeams).map(([psId, psTeams]) => (
                <section
                  key={psId}
                  className="rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden"
                >
                  <div className="px-4 sm:px-6 py-4 md:py-5 flex items-center justify-between border-b border-white/10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-lg">
                    <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide">
                      PS ID: {psId} - {psTeams.length} {psTeams.length === 1 ? "Team" : "Teams"}
                    </h3>
                  </div>

                  <div className="md:hidden p-4 space-y-3">
                    {psTeams.map((team) => {
                      const commitState = teamCommits[getTeamKey(team)]
                      const isLoading = commitState?.status === "loading"
                      const isPrivate = commitState?.status === "private"
                      const isRateLimited = commitState?.status === "rate_limited"
                      const parsedRepo = extractOwnerRepo(team.repoLink)
                      const repoDisplay = parsedRepo ? `${parsedRepo.owner}/${parsedRepo.repo}` : team.repoLink
                      const commitsLink = parsedRepo ? `https://github.com/${parsedRepo.owner}/${parsedRepo.repo}/commits` : null

                      const statusLabel = isLoading
                        ? "LOADING"
                        : isRateLimited
                          ? "RATE LIMITED"
                          : isPrivate
                            ? "PRIVATE"
                            : commitState?.totalCommits && commitState.totalCommits > 0
                              ? "ACTIVE"
                              : commitState?.totalCommits === 0
                                ? "INACTIVE"
                                : "UNKNOWN"

                      const statusClass = isLoading
                        ? "bg-white/10 text-white/70 border border-white/15"
                        : isRateLimited
                          ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                          : isPrivate
                            ? "bg-red-500/20 text-red-300 border border-red-400/40"
                            : commitState?.totalCommits && commitState.totalCommits > 0
                              ? "bg-emerald-500 text-black"
                              : "bg-red-500 text-white"

                      const flags: string[] = []
                      if (isPrivate) flags.push("PRIVATE")
                      if (isRateLimited) flags.push("RATE LIMITED")
                      if (!isLoading && !isPrivate && !isRateLimited && commitState?.totalCommits === 0) flags.push("NO COMMITS")

                      const lastPushDisplay = isLoading
                        ? "..."
                        : isRateLimited
                          ? "RATE LIMITED"
                          : isPrivate
                            ? "PRIVATE"
                            : commitState?.lastCommit || "-"

                      const commitDisplay = isLoading
                        ? "..."
                        : isRateLimited
                          ? "RATE LIMITED"
                          : isPrivate
                            ? "PRIVATE"
                            : commitState?.totalCommits?.toString() ?? "-"

                      return (
                        <article
                          key={`${team.psId}-${team.teamId}`}
                          onClick={() => window.open(team.repoLink, "_blank")}
                          className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 cursor-pointer shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] text-[#B06CFF]/80 font-mono uppercase tracking-wider">{team.teamId}</p>
                              <p className="text-sm font-semibold text-white truncate mt-1">{team.teamName}</p>
                              <p className="text-xs text-white/65 truncate mt-1">{repoDisplay}</p>
                            </div>
                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2">
                              <p className="text-white/45 uppercase tracking-wider text-[10px]">Last Push</p>
                              <p className="text-white font-semibold mt-1">{lastPushDisplay}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2">
                              <p className="text-white/45 uppercase tracking-wider text-[10px]">Commit Count</p>
                              <p className="text-white font-semibold mt-1">{commitDisplay}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5 min-h-[20px]">
                              {flags.length > 0 ? (
                                flags.map((flag) => (
                                  <span
                                    key={`${team.teamId}-${flag}`}
                                    className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-white/10 border border-white/15 text-white/80"
                                  >
                                    {flag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-white/30 text-[10px]">-</span>
                              )}
                            </div>

                            {commitsLink && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(commitsLink, "_blank")
                                }}
                                className="text-[#B06CFF] inline-flex items-center gap-1 text-xs"
                              >
                                Commits
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider border-b border-white/10 bg-white/10">
                          <th className="py-4 px-6 font-black text-white/40 w-28">Team ID</th>
                          <th className="py-4 px-6 font-black text-white">Team Name</th>
                          <th className="py-4 px-6 font-black text-white w-64">GitHub Repo</th>
                          <th className="py-4 px-6 font-black text-white text-center w-32">First Commit</th>
                          <th className="py-4 px-6 font-black text-white text-center w-32">Last Commit</th>
                          <th className="py-4 px-6 font-black text-white text-center w-32">Total Commits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {psTeams.map((team) => (
                          (() => {
                            const commitState = teamCommits[getTeamKey(team)]
                            const isLoading = commitState?.status === "loading"
                            const isPrivate = commitState?.status === "private"
                            const isRateLimited = commitState?.status === "rate_limited"
                            const parsedRepo = extractOwnerRepo(team.repoLink)
                            const commitsLink = parsedRepo ? `https://github.com/${parsedRepo.owner}/${parsedRepo.repo}/commits` : null
                            return (
                          <tr
                            key={`${team.psId}-${team.teamId}`}
                            onClick={() => window.open(team.repoLink, "_blank")}
                            className="border-b border-white/5 last:border-0 bg-transparent hover:bg-white/8 transition-colors cursor-pointer"
                          >
                            <td className="py-4 px-6 font-mono text-xs text-[#B06CFF]/80">{team.teamId}</td>
                            <td className="py-4 px-6 text-white font-semibold">{team.teamName}</td>
                            <td className="py-4 px-6 text-[#B06CFF] text-sm whitespace-nowrap">
                              <div className="inline-flex items-center gap-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-2">
                                  Open Repo
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </span>
                                {commitsLink && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(commitsLink, "_blank")
                                    }}
                                    className="text-[#B06CFF]/90 hover:text-[#B06CFF] underline underline-offset-2 whitespace-nowrap"
                                  >
                                    See Commits
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center text-white/45">
                              {isLoading ? (
                                <span className="animate-pulse">...</span>
                              ) : isRateLimited ? (
                                <span className="text-amber-400 font-semibold">RATE LIMITED</span>
                              ) : isPrivate ? (
                                <span className="text-red-400 font-semibold">PRIVATE</span>
                              ) : commitState?.firstCommit ? (
                                <span>{commitState.firstCommit}</span>
                              ) : (
                                <span className="text-white/40">-</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center text-white/45">
                              {isLoading ? (
                                <span className="animate-pulse">...</span>
                              ) : isRateLimited ? (
                                <span className="text-amber-400 font-semibold">RATE LIMITED</span>
                              ) : isPrivate ? (
                                <span className="text-red-400 font-semibold">PRIVATE</span>
                              ) : commitState?.lastCommit ? (
                                <span>{commitState.lastCommit}</span>
                              ) : (
                                <span className="text-white/40">-</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {isLoading ? (
                                <span className="animate-pulse text-white/45">...</span>
                              ) : isRateLimited ? (
                                <span className="text-amber-400 font-semibold">RATE LIMITED</span>
                              ) : isPrivate ? (
                                <span className="text-red-400 font-semibold">PRIVATE</span>
                              ) : commitState?.totalCommits && commitState.totalCommits > 0 ? (
                                <span className="text-emerald-400 font-semibold">{commitState.totalCommits}</span>
                              ) : commitState?.totalCommits === 0 ? (
                                <span className="text-red-400 font-semibold">0</span>
                              ) : (
                                <span className="text-white/40">-</span>
                              )}
                            </td>
                          </tr>
                            )
                          })()
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              {Object.keys(filteredGroupedTeams).length === 0 && (
                <div className="p-6 rounded-2xl bg-white/10 border border-white/20 text-white/45 text-sm text-center backdrop-blur-xl shadow-lg">
                  No teams found matching your search.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      <div
        className={`fixed bottom-4 right-3 left-3 md:left-auto md:right-6 z-40 px-5 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 backdrop-blur-xl text-emerald-200 text-sm font-medium shadow-2xl transition-opacity duration-500 ${
          showImportToast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {importToastMessage}
      </div>

      <div
        className={`fixed bottom-2 right-3 md:right-6 z-40 inline-flex items-center gap-2 text-xs text-white/70 transition-opacity duration-300 ${
          isFetchingCommitData ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B06CFF]" />
        <span>Fetching commit data...</span>
      </div>
    </div>
  )
}

"use client";

import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { 
  Upload, 
  ExternalLink, 
  Search, 
  ArrowUpDown, 
  LogOut, 
  FileSpreadsheet,
  Layers,
  Users,
  ExternalLink as OpenIcon
} from "lucide-react";
import { MeshGradient } from "@paper-design/shaders-react";
import { StarButton } from "./StarButton";

interface Team {
  teamId: string;
  teamName: string;
  psId: string;
  repoLink: string;
  firstCommit: string; // Mock for now: "-"
  lastCommit: string;  // Mock for now: "-"
  totalCommits: string; // Mock for now: "-"
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: "teamName" | "lastCommit" | "totalCommits";
    direction: "asc" | "desc";
  }>({ key: "teamName", direction: "asc" });

  const [importStats, setImportStats] = useState<{
    teams: number;
    psCount: number;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (file.name.endsWith(".csv")) {
        Papa.parse(bstr as string, {
          header: true,
          complete: (results) => {
            processImportedData(results.data as Record<string, string>[]);
          },
        });
      } else {
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        processImportedData(data);
      }
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processImportedData = (data: Record<string, string>[]) => {
    const newTeams: Team[] = data.map((row) => {
      // Find columns by case-insensitive name
      const findVal = (names: string[]) => {
        const key = Object.keys(row).find((k) => 
          names.some((n) => k.toLowerCase() === n.toLowerCase())
        );
        return key ? String(row[key]) : "";
      };

      return {
        teamId: findVal(["Team ID", "TeamID", "ID"]),
        teamName: findVal(["Team Name", "TeamName", "Name"]),
        psId: findVal(["PS ID", "PSID", "Problem Statement ID"]),
        repoLink: findVal(["GitHub Repo Link", "Repo Link", "GitHub", "Repository"]),
        firstCommit: "-",
        lastCommit: "-",
        totalCommits: "-",
      };
    }).filter(t => t.teamId && t.repoLink);

    setTeams(newTeams);
    
    const uniquePS = new Set(newTeams.map(t => t.psId));
    setImportStats({
      teams: newTeams.length,
      psCount: uniquePS.size
    });
  };

  const groupedTeams = useMemo(() => {
    const groups: Record<string, Team[]> = {};
    
    // Filter by search
    const filtered = teams.filter(t => 
      t.teamName.toLowerCase().includes(search.toLowerCase()) ||
      t.teamId.toLowerCase().includes(search.toLowerCase()) ||
      t.psId.toLowerCase().includes(search.toLowerCase())
    );

    filtered.forEach((team) => {
      if (!groups[team.psId]) groups[team.psId] = [];
      groups[team.psId].push(team);
    });

    // Sort within groups
    Object.keys(groups).forEach(psId => {
      groups[psId].sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (sortConfig.key === "totalCommits" || sortConfig.key === "lastCommit") {
          // Since they are currently "-", we just keep order or mock comparison
          return 0;
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    });

    return groups;
  }, [teams, search, sortConfig]);

  const openAllRepos = (psId: string) => {
    const psTeams = groupedTeams[psId] || [];
    psTeams.forEach(team => {
      if (team.repoLink) {
        window.open(team.repoLink, "_blank");
      }
    });
  };

  const toggleSort = (key: typeof sortConfig.key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <div className="min-h-screen relative bg-black flex flex-col items-center py-10 px-6 font-sans overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MeshGradient
          className="absolute inset-0 w-full h-full"
          colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
          speed={0.3}
        />
        <MeshGradient
          className="absolute inset-0 w-full h-full opacity-60"
          colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
          speed={0.2}
        />
      </div>

      <div className="z-10 w-full max-w-7xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Layers className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Admin Hub</h1>
          </div>

          <button 
            onClick={onLogout}
            className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm group cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Sign Out
          </button>
        </div>

        {/* Import Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col gap-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileSpreadsheet className="w-32 h-32 text-white" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-xl font-bold text-white mb-2">Import Team Data</h2>
              <p className="text-white/50 text-sm mb-6 max-w-md">
                Upload your Excel (.xlsx) or CSV file containing Team ID, Name, PS ID, and GitHub Repo Links.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="relative flex-1 group cursor-pointer">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileUpload}
                    className="hidden" 
                  />
                  <div className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 font-bold hover:bg-cyan-500/30 transition-all active:scale-95">
                    <Upload className="w-5 h-5" />
                    SELECT FILE
                  </div>
                </label>
                
                {importStats && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {importStats.teams} teams imported across {importStats.psCount} PS IDs
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col justify-center items-center gap-4 shadow-xl">
             <div className="p-4 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                <Users className="w-8 h-8 text-cyan-400" />
             </div>
             <div className="text-center">
                <div className="text-3xl font-black text-white">{teams.length}</div>
                <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Total Enrolled Teams</div>
             </div>
          </div>
        </div>

        {teams.length === 0 && (
          <div className="p-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-100 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-wider mb-2">Import Required</h3>
            <p className="text-sm text-cyan-100/80">
              Import an Excel or CSV file to populate the dashboard. Include Team ID, Team Name, PS ID, and GitHub Repo Link columns, then click SELECT FILE above.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shadow-xl">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by Team Name, ID or PS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => toggleSort("teamName")}
              className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                sortConfig.key === "teamName" 
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200" 
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              Name <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => toggleSort("totalCommits")}
              className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                sortConfig.key === "totalCommits" 
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200" 
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              Commits <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Groups */}
        <div className="flex flex-col gap-12 mb-20">
          {Object.entries(groupedTeams).length > 0 ? (
            Object.entries(groupedTeams).map(([psId, psTeams]) => (
              <section key={psId} className="flex flex-col gap-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-black uppercase tracking-wider">
                      PS ID: {psId}
                    </div>
                    <div className="text-white/40 text-sm font-medium">
                      {psTeams.length} {psTeams.length === 1 ? 'Team' : 'Teams'}
                    </div>
                  </div>
                  
                  <StarButton 
                    onClick={() => openAllRepos(psId)}
                    className="!px-6 !py-2.5 !text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <OpenIcon className="w-3.5 h-3.5" />
                      OPEN ALL REPOS
                    </div>
                  </StarButton>
                </div>

                <div className="w-full bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-md shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-wider">
                        <th className="py-5 px-6 font-black text-white/40 w-24">Team ID</th>
                        <th className="py-5 px-6 font-black text-white">Team Name</th>
                        <th className="py-5 px-6 font-black text-white text-center w-32">First Commit</th>
                        <th className="py-5 px-6 font-black text-white text-center w-32">Last Commit</th>
                        <th className="py-5 px-6 font-black text-white text-center w-32">Total</th>
                        <th className="py-5 px-6 font-black text-white text-right w-20">Repo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {psTeams.map((team) => (
                        <tr 
                          key={team.teamId}
                          onClick={() => window.open(team.repoLink, "_blank")}
                          className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <td className="py-5 px-6">
                            <span className="font-mono text-xs text-cyan-300/70">{team.teamId}</span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                              {team.teamName}
                            </div>
                          </td>
                          <td className="py-5 px-6 text-center text-white/40 text-sm font-mono">{team.firstCommit}</td>
                          <td className="py-5 px-6 text-center text-white/40 text-sm font-mono">{team.lastCommit}</td>
                          <td className="py-5 px-6 text-center">
                            <span className="px-3 py-1 rounded-lg bg-white/5 text-white/60 text-xs font-bold border border-white/10">
                              {team.totalCommits}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                             <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-white transition-colors ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-sm">
               <div className="p-6 rounded-full bg-white/5">
                 <Search className="w-12 h-12 text-white/10" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white">No Teams Found</h3>
                  <p className="text-white/40 text-sm max-w-xs">
                    {teams.length === 0 
                      ? "Start by importing an Excel or CSV file containing your hackathon teams."
                      : "No teams match your current search or filter criteria."}
                  </p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

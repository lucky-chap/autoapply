"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Loader2, Mail, Users, Reply, AlertCircle, ArrowLeft } from "lucide-react";

// Mock userId for now, in a real app this would come from auth
const userId = "user_123"; 

export default function OutreachDashboard() {
  const stats = useQuery(api.outreach.queries.getOutreachStats, { userId });
  const prospects = useQuery(api.outreach.queries.getProspects, { userId });
  const logs = useQuery(api.outreach.queries.getOutreachLogs, { userId });

  if (!stats || !prospects || !logs) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-black/50 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>

      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-black sm:text-5xl md:leading-[1.1]">
          Outreach Automation
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
          Monitor your automated outbound efforts and prospect engagement.
        </p>
      </div>
      
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProspects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emailsSent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.repliesReceived}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bounceRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Recent Prospects */}
        <Card>
          <CardHeader>
            <CardTitle>Identified Prospects</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{p.company}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "verified" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Outreach Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Outreach History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>{new Date(log.sentAt).toLocaleDateString()}</TableCell>
                    <TableCell>{log.prospectName}</TableCell>
                    <TableCell>{log.company}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "default" : log.status === "replied" ? "secondary" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

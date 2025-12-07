import React, { useEffect, useState, useContext } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Card, Button, ActivityIndicator } from "react-native-paper";
import { Users, Ticket, MessageSquare, TrendingUp, LogOut } from "@expo/vector-icons";
import { fetchCustomers, fetchCurrentTenant, fetchTickets } from "../api";
import { AuthContext } from "../context/AuthContext";

interface StatsCardProps {
  title: string;
  value: string;
  icon: any;
  trend: string;
  color: string;
}

function StatsCard({ title, value, icon: Icon, trend, color }: StatsCardProps) {
  return (
    <Card style={styles.statsCard}>
      <Card.Content style={styles.statsContent}>
        <View style={styles.statsLeft}>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
          <Text style={styles.statsTrend}>{trend}</Text>
        </View>
        <View style={[styles.statsIcon, { backgroundColor: color + "20" }]}>
          <Icon size={24} color={color} />
        </View>
      </Card.Content>
    </Card>
  );
}

export default function Dashboard() {
  const { signOut } = useContext(AuthContext);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [cRes, tRes, tenantRes] = await Promise.all([
        fetchCustomers(),
        fetchTickets(),
        fetchCurrentTenant(),
      ]);
      setCustomers(cRes.data || []);
      setTickets(tRes.data || []);
      setTenant(tenantRes.data);
    } catch (e) {
      console.log("Error loading data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openTickets = tickets.filter((t) => t.status === "open").length;
  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;
  const resolvedCount = tickets.filter((t) => t.status === "closed").length;
  const resolutionRate =
    tickets.length > 0 ? Math.round((resolvedCount / tickets.length) * 100) : 0;

  const activeCustomers = customers.filter((c) => c.status === "active").length;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome back! Here's what's happening with your CRM.
          </Text>
        </View>
        <Button
          mode="outlined"
          onPress={signOut}
          icon={() => <LogOut size={16} color="#ef4444" />}
          textColor="#ef4444"
          style={styles.logoutButton}
        >
          Logout
        </Button>
      </View>

      {tenant && (
        <Card style={styles.tenantCard}>
          <Card.Content>
            <Text style={styles.tenantLabel}>Current Tenant</Text>
            <Text style={styles.tenantName}>{tenant.name}</Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.statsGrid}>
        <StatsCard
          title="Total Customers"
          value={customers.length.toString()}
          icon={Users}
          trend={`${activeCustomers} active`}
          color="#3b82f6"
        />
        <StatsCard
          title="Open Tickets"
          value={openTickets.toString()}
          icon={Ticket}
          trend={`${highPriorityCount} high priority`}
          color="#ef4444"
        />
        <StatsCard
          title="Total Tickets"
          value={tickets.length.toString()}
          icon={MessageSquare}
          trend={`${resolvedCount} resolved`}
          color="#8b5cf6"
        />
        <StatsCard
          title="Resolution Rate"
          value={`${resolutionRate}%`}
          icon={TrendingUp}
          trend="This month"
          color="#22c55e"
        />
      </View>

      <Card style={styles.recentCard}>
        <Card.Title title="Recent Tickets" />
        <Card.Content>
          {tickets.length === 0 ? (
            <Text style={styles.emptyText}>No tickets yet</Text>
          ) : (
            tickets.slice(0, 5).map((ticket: any) => (
              <View key={ticket.id} style={styles.ticketItem}>
                <View style={styles.ticketLeft}>
                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketDescription} numberOfLines={1}>
                    {ticket.description}
                  </Text>
                  <View style={styles.ticketMeta}>
                    <Text
                      style={[
                        styles.ticketStatus,
                        { color: ticket.status === "open" ? "#ef4444" : "#22c55e" },
                      ]}
                    >
                      {ticket.status}
                    </Text>
                    <Text style={styles.ticketPriority}>
                      {ticket.priority || "normal"} priority
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.customersCard}>
        <Card.Title title="Customers" />
        <Card.Content>
          {customers.length === 0 ? (
            <Text style={styles.emptyText}>No customers yet</Text>
          ) : (
            customers.slice(0, 5).map((customer: any) => (
              <View key={customer.id} style={styles.customerItem}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerEmail}>{customer.email}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  logoutButton: {
    borderColor: "#ef4444",
  },
  tenantCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 2,
  },
  tenantLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statsCard: {
    width: "48%",
    marginBottom: 12,
    marginRight: "2%",
    elevation: 2,
  },
  statsContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsLeft: {
    flex: 1,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  statsTrend: {
    fontSize: 11,
    color: "#9ca3af",
  },
  statsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  recentCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 2,
  },
  customersCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
  },
  ticketItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  ticketLeft: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  ticketDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  ticketMeta: {
    flexDirection: "row",
    gap: 12,
  },
  ticketStatus: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  ticketPriority: {
    fontSize: 12,
    color: "#9ca3af",
  },
  customerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: "#6b7280",
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    paddingVertical: 20,
  },
});

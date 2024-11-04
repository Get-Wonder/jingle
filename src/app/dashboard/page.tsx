/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TimelineIcon from "@mui/icons-material/Timeline";
import GroupWorkIcon from '@mui/icons-material/GroupWork';

export default function Dashboard() {
  const [jobs, setJobs] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    wait: 0,
  });
  const [failedData, setFailedData] = useState([]);
  const [workers, setWorkers] = useState([]);

  const EXPECTED_WORKERS = 5; // Número esperado de workers

  const fetchJobs = async () => {
    const result = await fetch("/api/jobs", {
      method: "GET",
    });

    const data = await result.json();
    setJobs(data?.data);
    setFailedData(Array.isArray(data?.failedJobs) ? data.failedJobs : []);
    setWorkers(Array.isArray(data?.workers) ? data?.workers : []);
  };

  useEffect(() => {
    fetchJobs();

    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = (timestamp: any) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const workerStatus = {
    current: workers?.length || 0,
    expected: EXPECTED_WORKERS,
    isHealthy: (workers?.length || 0) === EXPECTED_WORKERS
  };

  const statCards = [
    {
      title: "Activos",
      value: jobs?.active || 0,
      icon: <TimelineIcon sx={{ color: "#2196f3", fontSize: 20 }} />,
    },
    {
      title: "Completados",
      value: jobs?.completed || 0,
      icon: <CheckCircleOutlineIcon sx={{ color: "#4caf50", fontSize: 20 }} />,
    },
    {
      title: "Fallidos",
      value: jobs?.failed || 0,
      icon: <ErrorOutlineIcon sx={{ color: "#f44336", fontSize: 20 }} />,
    },
    {
      title: "En Espera",
      value: jobs?.wait || 0,
      icon: <AccessTimeIcon sx={{ color: "#ffb300", fontSize: 20 }} />,
    },
  ];

  return (
    <Box sx={{ bgcolor: "#f5f5f5", minHeight: "100vh", pb: 4 }}>
      <Container>
        <Typography
          variant="h4"
          sx={{ py: 3, fontWeight: "bold", color: "black" }}
        >
          Dashboard
        </Typography>

        {/* Workers Status Card */}
        <Card
          sx={{
            bgcolor: "white",
            boxShadow: "0px 2px 4px rgba(0,0,0,0.05)",
            mb: 4,
          }}
        >
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                py: 2,
              }}
            >
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: "1.25rem",
                  mb: 1,
                }}
              >
                Estado de Workers
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  bgcolor: workerStatus.isHealthy ? "#e8f5e9" : "#ffebee",
                  borderRadius: 2,
                  px: 4,
                  py: 2,
                }}
              >
                <GroupWorkIcon 
                  sx={{ 
                    fontSize: 40,
                    color: workerStatus.isHealthy ? "#4caf50" : "#f44336"
                  }} 
                />
                <Typography
                  variant="h3"
                  component="div"
                  sx={{
                    fontWeight: "bold",
                    color: workerStatus.isHealthy ? "#2e7d32" : "#d32f2f",
                  }}
                >
                  {workerStatus.current}/{workerStatus.expected}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Grid container spacing={2} maxWidth="xl" sx={{ margin: "0 auto", mb: 4 }}>
          {statCards.map((stat, index) => (
            <Grid item xs={6} sm={6} md={3} key={index}>
              <Card
                sx={{
                  bgcolor: "white",
                  boxShadow: "0px 2px 4px rgba(0,0,0,0.05)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{
                        fontSize: "0.875rem",
                        mb: 0.5,
                      }}
                    >
                      {stat.title}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        variant="h4"
                        component="div"
                        sx={{
                          fontWeight: "bold",
                          fontSize: "1.875rem",
                        }}
                      >
                        {stat.value}
                      </Typography>
                      {stat.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Failed Jobs Table */}
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: "bold", color: "black" }}
            >
              Jobs Fallidos
            </Typography>
            <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Texto</TableCell>
                    <TableCell>Razón del Fallo</TableCell>
                    <TableCell>Fecha de Proceso</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {failedData.map((job: any) => (
                    <TableRow
                      key={job.id}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{job.data?.text || 'N/A'}</TableCell>
                      <TableCell>{job.failedReason || 'N/A'}</TableCell>
                      <TableCell>{formatDate(job.processedOn) || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {failedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No hay jobs fallidos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import * as mqtt from 'mqtt';
import { io, Socket } from 'socket.io-client';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'vehicle-health-frontend';
  
  // Standard UI States
  temperature: number | null = null;
  voltage: number | null = null;
  cycles: number | null = null;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isLoading = false;
  results: any = null;

  // Real-Time IoT States
  activeTab: 'live' | 'analysis' = 'live';
  isLiveMode = true;
  private mqttClient: mqtt.MqttClient | null = null;
  private socket: Socket | null = null;
  liveSensorData: any = null;
  isDataPulsing = false; // For visual feedback

  // Graph States
  liveChart: any;
  chartLabels: string[] = [];
  voltData: number[] = [];
  healthData: number[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    // 1. Fetch Historical Data from DynamoDB (via Backend API)
    this.fetchTelemetryHistory();

    // 2. Connect to Real-Time Streams (MQTT + Socket.IO Fallback)
    this.initMqttConnection();
    this.initSocketConnection();
  }

  initSocketConnection() {
    const host = window.location.hostname;
    const socketUrl = `http://${host}:5000`;
    
    console.log(`🔌 Initializing Socket.IO Fallback: ${socketUrl}`);
    this.socket = io(socketUrl);

    this.socket.on('iot-battery-tick', (data) => {
      console.log("📥 Socket.IO Feed:", data);
      this.handleLiveTelemetry(data, 'Socket.IO');
    });

    this.socket.on('connect', () => console.log('✅ Socket.IO Connected'));
  }

  initMqttConnection() {
    const brokerHost = window.location.hostname;
    // Connect to the MQTT-over-WebSockets port we opened in the backend
    const mqttUrl = `ws://${brokerHost}:8888`;
    
    console.log(`🔌 Connecting to Live MQTT Stream: ${mqttUrl}`);
    
    this.mqttClient = mqtt.connect(mqttUrl);

    this.mqttClient.on('connect', () => {
      console.log('✅ Connected to MQTT Broker');
      this.mqttClient?.subscribe('vehicle/telemetry/live');
    });

    this.mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("📥 MQTT Feed:", data);
        this.handleLiveTelemetry(data, 'MQTT');
      } catch (e) {
        console.error('Error parsing MQTT message', e);
      }
    });

    this.mqttClient.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
    });
  }

  handleLiveTelemetry(data: any, source: string) {
    console.log(`📡 [${source}] Processing Telemetry:`, data);
    if (!this.isLiveMode) return;

    // Pulse effect
    this.isDataPulsing = true;
    setTimeout(() => this.isDataPulsing = false, 500);
    
    this.liveSensorData = data;
    this.temperature = data.temperature;
    this.voltage = parseFloat(data.voltage).toFixed(2) as any;
    this.cycles = data.cycles;
    
    let calculatedHealth = data.health_score || Math.max(10, 100 - (data.temperature > 30 ? 30 : 0));

    this.results = {
      final_health_score: calculatedHealth,
      battery_health_prediction: calculatedHealth > 60 ? 'Optimal' : 'Degrading',
      damage_detection: "AWS IoT MQTT Active",
      confidence_score: 1.0,
      root_cause_explanation: "Live MQTT stream calculating active degradation..."
    };

    // Graph Live Injection
    if (this.liveChart) {
        const timeStr = new Date().toLocaleTimeString();
        if (this.chartLabels.length > 20) {
            this.chartLabels.shift();
            this.voltData.shift();
            this.healthData.shift();
        }
        this.chartLabels.push(timeStr);
        this.voltData.push(parseFloat(data.voltage));
        this.healthData.push(calculatedHealth);
        this.liveChart.update();
    }
    
    // FORCE Angular to update
    this.cdr.detectChanges();
  }

  initChart() {
    const canvas = document.getElementById('telemetryGraph') as HTMLCanvasElement;
    if (!canvas) return;
    
    // Destroy previous chart if it exists to avoid overlapping
    if(this.liveChart) {
        this.liveChart.destroy();
    }
    
    this.liveChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.chartLabels,
        datasets: [
          {
            label: 'Voltage (V)',
            data: this.voltData,
            borderColor: '#facc15',
            backgroundColor: 'rgba(250, 204, 21, 0.2)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Battery Health (%)',
            data: this.healthData,
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.2)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         interaction: { mode: 'index', intersect: false },
         animation: { duration: 0 }, 
         scales: {
             y: { type: 'linear', display: true, position: 'left', title: {display: true, color: '#facc15', text: 'Voltage'}, min: 2.5, max: 4.5, grid: { color: 'rgba(255,255,255,0.1)' } },
             y1: { type: 'linear', display: true, position: 'right', title: {display: true, color: '#4ade80', text: 'Health Score'}, min: 0, max: 100, grid: { drawOnChartArea: false } },
             x: { grid: { color: 'rgba(255,255,255,0.05)' } }
         },
         plugins: { legend: { labels: { color: '#fff' } } }
      }
    });
  }

  ngOnDestroy() {
    if (this.liveChart) this.liveChart.destroy();
    if (this.mqttClient) this.mqttClient.end();
    if (this.socket) this.socket.disconnect();
  }

  fetchTelemetryHistory() {
    this.http.get<any[]>('/api/telemetry/history').subscribe({
      next: (data) => {
        console.log("Loaded Historical Telemetry from DynamoDB:", data);
        if (data && data.length > 0) {
          this.chartLabels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
          this.voltData = data.map(d => parseFloat(d.voltage));
          this.healthData = data.map(d => d.health_score || 100);
          
          // Latest values for the UI cards
          const latest = data[data.length - 1];
          this.temperature = latest.temperature;
          this.voltage = parseFloat(latest.voltage).toFixed(2) as any;
          this.cycles = latest.cycles;
        }
        
        // Always init chart after history attempt
        setTimeout(() => this.initChart(), 0);
      },
      error: (err) => {
        console.error("Failed to load history", err);
        this.initChart(); // Init empty if failed
      }
    });
  }

  switchTab(tab: 'analysis' | 'live') {
    this.activeTab = tab;
    if (tab === 'live') {
      this.isLiveMode = true;
      this.results = {
        final_health_score: 100,
        battery_health_prediction: 'Waiting for MQTT Stream...',
        damage_detection: 'N/A in Live Mode',
        confidence_score: 0.0,
        root_cause_explanation: "Subscribing to vehicle/telemetry/live via WebSockets..."
      };
      
      setTimeout(() => {
          this.initChart();
      }, 100);
    } else {
      this.isLiveMode = false;
      this.reset();
    }
  }

  toggleLiveMode() {
    this.switchTab(this.isLiveMode ? 'analysis' : 'live');
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => this.previewUrl = reader.result;
      reader.readAsDataURL(file);
    }
  }

  analyzeVehicle() {
    if (!this.selectedFile || this.temperature === null || this.voltage === null || this.cycles === null) {
      alert("Please fill all sensor inputs and select a mock image.");
      return;
    }

    this.isLoading = true;
    this.results = null;

    const formData = new FormData();
    formData.append('vehicle_image', this.selectedFile);
    formData.append('temperature', this.temperature.toString());
    formData.append('voltage', this.voltage.toString());
    formData.append('cycles', this.cycles.toString());

    this.http.post('/api/analyze', formData).subscribe({
      next: (res: any) => {
        this.results = res;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Analysis error', err);
        alert('An error occurred during analysis. Check the backend logs.');
        this.isLoading = false;
      }
    });
  }

  reset() {
    this.temperature = null;
    this.voltage = null;
    this.cycles = null;
    this.selectedFile = null;
    this.previewUrl = null;
    this.results = null;
  }
}

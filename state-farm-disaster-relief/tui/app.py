#!/usr/bin/env python3
"""CrisMin Terminal UI — State Farm Catastrophe Response Platform."""

import asyncio
import random
from datetime import datetime

import httpx
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.reactive import reactive
from textual.widgets import (
    Button,
    DataTable,
    Footer,
    Header,
    Input,
    Label,
    Static,
)

API_BASE = "http://localhost:8000"


class KPICard(Static):
    """A single metric card."""

    def __init__(self, label: str, value: str, status: str = "neutral") -> None:
        super().__init__()
        self.label = label
        self.value = value
        self.status = status

    def compose(self) -> ComposeResult:
        yield Label(self.label, classes="kpi-label")
        yield Label(self.value, classes="kpi-value")


class MapDisplay(Static):
    """ASCII storm radar map with claim and unit pins."""

    claims: list[dict] = reactive([])
    units: list[dict] = reactive([])

    def render_map(self) -> str:
        lines = [
            "Gulf Coast Storm Radar",
            "======================",
            "",
            "        HURRICANE CONE",
            "      ╭───────────────╮",
            "    ╱                   ╲",
            "   │                     │",
        ]
        for claim in self.claims:
            lat = claim["lat"]
            lng = claim["lng"]
            row = 3 + int((lat - 27.0) / 4.0 * 6)
            col = 4 + int((lng + 91.0) / 7.0 * 20)
            if 0 <= row < len(lines):
                lines[row] = lines[row][:col] + "●" + lines[row][col + 1:]
        for unit in self.units:
            lat = unit["lat"]
            lng = unit["lng"]
            row = 3 + int((lat - 27.0) / 4.0 * 6)
            col = 4 + int((lng + 91.0) / 7.0 * 20)
            if 0 <= row < len(lines):
                lines[row] = lines[row][:col] + "▲" + lines[row][col + 1:]
        lines += [
            "   │                     │",
            "    ╲                   ╱",
            "      ╰───────────────╯",
            "",
            "● Claims   ▲ Response Units",
        ]
        return "\n".join(lines)

    def watch_claims(self, old: list[dict], new: list[dict]) -> None:
        self.update(self.render_map())

    def watch_units(self, old: list[dict], new: list[dict]) -> None:
        self.update(self.render_map())

    def on_mount(self) -> None:
        self.update(self.render_map())


class RedAlert(Static):
    """Red alert weather widget."""

    alerts: list[str] = reactive([])

    def render_alerts(self) -> str:
        if not self.alerts:
            return "No active alerts"
        lines = ["RED ALERT  ●  active"]
        for alert in self.alerts:
            lines.append(f"  {alert}")
        return "\n".join(lines)

    def watch_alerts(self, old: list[str], new: list[str]) -> None:
        self.update(self.render_alerts())

    def on_mount(self) -> None:
        self.update(self.render_alerts())


class CrisMinApp(App):
    """Main CrisMin TUI application."""

    TITLE = "CrisMin"
    SUB_TITLE = "State Farm Catastrophe Response & Optimization"

    total_claims: int = reactive(0)
    deployed_units: int = reactive(0)
    pending_units: int = reactive(0)
    avg_response: str = reactive("< 2s")

    claims_data: list[dict] = reactive([])
    fleet_data: list[dict] = reactive([])
    optimization_result: dict | None = reactive(None)
    log_messages: list[str] = reactive([])
    map_claims: list[dict] = reactive([])
    map_units: list[dict] = reactive([])
    red_alerts: list[str] = reactive([])

    CSS = """
    Screen {
        layout: vertical;
        background: #0a0a0a;
        color: #e5e5e5;
    }
    Header {
        background: #0a0a0a;
        color: #ffffff;
        border-bottom: solid #1a1a1a;
        height: 3;
    }
    .title {
        text-style: bold;
        color: #ffffff;
        margin: 1 0 0 1;
    }
    .subtitle {
        color: #666666;
        margin: 0 0 1 1;
    }
    .kpi-row {
        height: 6;
        layout: horizontal;
        margin: 0 1;
    }
    .kpi-card {
        border: solid #1a1a1a;
        padding: 0 1;
        width: 1fr;
        height: 1fr;
    }
    .kpi-label {
        color: #888888;
        text-style: bold;
        margin: 1 0 0 0;
    }
    .kpi-value {
        text-style: bold;
        color: #ffffff;
        margin: 0 0 1 0;
    }
    .main {
        height: 1fr;
        layout: horizontal;
        margin: 0 1;
    }
    .sidebar {
        width: 32;
        border-right: solid #1a1a1a;
    }
    .content {
        width: 1fr;
    }
    .box {
        border: solid #1a1a1a;
        margin: 1;
        height: 1fr;
    }
    .map-box {
        height: 1fr;
    }
    .fleet-box {
        height: 1fr;
    }
    .claims-box {
        height: 1fr;
    }
    .resource-box {
        height: 1fr;
    }
    .log-box {
        height: 12;
        border: solid #1a1a1a;
        margin: 1;
    }
    .input-row {
        height: 5;
        layout: horizontal;
        margin: 0 1;
    }
    .red-alert {
        height: 7;
        border: solid #330000;
        background: #110000;
        margin: 0 1;
        color: #ff6666;
    }
    Input {
        width: 1fr;
        margin: 0 1;
    }
    Button {
        margin: 0 1;
    }
    DataTable {
        height: 1fr;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("crismin", classes="title")
        yield Label(
            "state farm catastrophe response  optimization platform",
            classes="subtitle",
        )

        with Horizontal(classes="kpi-row"):
            yield KPICard(
                "total claims", "0", "neutral", classes="kpi-card"
            )
            yield KPICard(
                "deployed units", "0", "deployed", classes="kpi-card"
            )
            yield KPICard(
                "pending units", "0", "pending", classes="kpi-card"
            )
            yield KPICard(
                "avg response", "< 2s", "neutral", classes="kpi-card"
            )

        yield RedAlert(classes="red-alert")

        with Horizontal(classes="main"):
            with Vertical(classes="sidebar"):
                with Vertical(classes="box map-box"):
                    yield Label("storm radar", classes="kpi-label")
                    yield MapDisplay(id="map-display")
                with Vertical(classes="box fleet-box"):
                    yield Label(
                        "catastrophe response units", classes="kpi-label"
                    )
                    yield Static(id="fleet-display")

            with Vertical(classes="content"):
                with Vertical(classes="box claims-box"):
                    yield Label("incoming claims feed", classes="kpi-label")
                    yield DataTable(id="claims-table")
                with Vertical(classes="box resource-box"):
                    yield Label("resource allocation", classes="kpi-label")
                    yield Static(id="resource-display")

        with Vertical(classes="log-box"):
            yield Label("dispatch log", classes="kpi-label")
            yield Static(id="dispatch-log")

        with Horizontal(classes="input-row"):
            yield Input(
                placeholder="enter telemetry report...", id="telemetry-input"
            )
            yield Button("ingest telemetry", id="btn-ingest")
            yield Button("run optimization", id="btn-optimize")
            yield Button("refresh", id="btn-refresh")

        yield Footer()

    def watch_total_claims(self, old: int, new: int) -> None:
        self._update_kpi("total claims", str(new))

    def watch_deployed_units(self, old: int, new: int) -> None:
        self._update_kpi("deployed units", str(new))

    def watch_pending_units(self, old: int, new: int) -> None:
        self._update_kpi("pending units", str(new))

    def watch_avg_response(self, old: str, new: str) -> None:
        self._update_kpi("avg response", new)

    def _update_kpi(self, label: str, value: str) -> None:
        for card in self.query(KPICard):
            if card.label == label:
                value_label = card.query_one(".kpi-value", Label)
                value_label.update(value)
                break

    def on_mount(self) -> None:
        self._init_claims_table()
        self._seed_dispatch_log()
        self._start_live_updates()
        self._load_initial_data()

    def _init_claims_table(self) -> None:
        table = self.query_one("#claims-table", DataTable)
        table.add_columns("claim", "location", "damage", "time", "severity")

    def _seed_dispatch_log(self) -> None:
        self.log_messages = [
            "09:30 AM  system online  catastrophe response platform active",
            "09:35 AM  nemotron normalized 47 telemetry reports",
            "09:42 AM  qubo solver complete  4 units assigned",
            "09:48 AM  flooding reported  new orleans, la  priority high",
            "09:55 AM  cru mobile command unit 1 deployed  gulfport, ms",
            "10:01 AM  hurricane tracking cone updated  gulf coast",
            "10:05 AM  supply truck delta staged  pensacola, fl  idle",
            "10:08 AM  severe weather front crossing mobile bay",
            "10:12 AM  claims adjuster team a en route  mobile, al",
            "10:15 AM  cru mobile command unit 2 deployed  biloxi, ms",
        ]
        self._refresh_dispatch_log()

    def _start_live_updates(self) -> None:
        self.set_interval(5.0, self._simulate_dispatch_update)

    def _simulate_dispatch_update(self) -> None:
        now = datetime.now().strftime("%I:%M %p")
        events = [
            f"{now}  telemetry report ingested  structural damage detected",
            f"{now}  qubo optimization cycle complete",
            f"{now}  weather alert  wind speeds increasing near coast",
        ]
        event = random.choice(events)
        self.log_messages.insert(0, event)
        self.log_messages = self.log_messages[:20]
        self._refresh_dispatch_log()

    def _refresh_dispatch_log(self) -> None:
        log_widget = self.query_one("#dispatch-log", Static)
        log_widget.update("\n".join(self.log_messages))

    def _load_initial_data(self) -> None:
        self.map_claims = [
            {"lat": 30.69, "lng": -88.04, "severity": 9, "label": "Claim #4"},
            {"lat": 30.37, "lng": -89.09, "severity": 8, "label": "Claim #11"},
            {"lat": 30.42, "lng": -87.22, "severity": 10, "label": "Claim #18"},
        ]
        self.map_units = [
            {"lat": 30.37, "lng": -89.09, "status": "Deployed", "label": "MC Unit 1"},
            {"lat": 30.69, "lng": -88.04, "status": "En Route", "label": "Adjuster A"},
            {"lat": 30.42, "lng": -87.22, "status": "Idle", "label": "Supply Delta"},
        ]
        self.red_alerts = [
            "Severe Thunderstorm  Mobile, AL  10:14 AM",
            "Hurricane Watch  Gulf Coast  10:09 AM",
            "Flash Flood Warning  New Orleans, LA  10:03 AM",
        ]
        self.fleet_data = [
            {
                "name": "Mobile Command Unit 1",
                "type": "Command Vehicle",
                "status": "Deployed",
                "location": "Gulfport, MS",
            },
            {
                "name": "Claims Adjuster Team A",
                "type": "Adjuster Team",
                "status": "En Route",
                "location": "Mobile, AL",
            },
            {
                "name": "Supply Truck Delta",
                "type": "Supply Vehicle",
                "status": "Idle",
                "location": "Pensacola, FL",
            },
            {
                "name": "Mobile Command Unit 2",
                "type": "Command Vehicle",
                "status": "Deployed",
                "location": "Biloxi, MS",
            },
        ]
        self._render_fleet()
        self._render_resource()
        self._render_claims_table()

    def _render_claims_table(self) -> None:
        table = self.query_one("#claims-table", DataTable)
        table.clear()
        mock_claims = [
            ("Claim #4", "Mobile, AL", "Roof Damage", "10:14 AM", 9),
            ("Claim #11", "Gulfport, MS", "Water Intrusion", "10:09 AM", 8),
            ("Claim #18", "Pensacola, FL", "Structural Collapse", "10:03 AM", 10),
            ("Claim #23", "Biloxi, MS", "Roof Damage", "9:58 AM", 6),
            ("Claim #31", "New Orleans, LA", "Flooding", "9:52 AM", 7),
            ("Claim #37", "Mobile, AL", "Shingle Loss", "9:45 AM", 4),
            ("Claim #42", "Gulfport, MS", "Water Intrusion", "9:38 AM", 5),
            ("Claim #49", "Pensacola, FL", "Downed Power Lines", "9:30 AM", 8),
        ]
        for claim in mock_claims:
            table.add_row(*claim)

    def _render_fleet(self) -> None:
        lines = []
        for unit in self.fleet_data:
            lines.append(f"{unit['name']}  [{unit['type']}]")
            lines.append(f"  {unit['location']}  [{unit['status']}]")
            lines.append("")
        fleet_widget = self.query_one("#fleet-display", Static)
        fleet_widget.update("\n".join(lines))

    def _render_resource(self) -> None:
        resources = [
            ("personnel", 142, 160),
            ("vehicles", 38, 52),
            ("supplies", 94, 110),
        ]
        lines = ["efficiency 88%"]
        for name, deployed, requested in resources:
            pct = round(deployed / requested * 100)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            lines.append(f"{name:12s} {deployed:3d}/{requested:3d}  [{bar}] {pct}%")
        resource_widget = self.query_one("#resource-display", Static)
        resource_widget.update("\n".join(lines))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        if button_id == "btn-ingest":
            self.action_ingest()
        elif button_id == "btn-optimize":
            self.action_optimize()
        elif button_id == "btn-refresh":
            self.action_refresh()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "telemetry-input":
            report = event.input.value.strip()
            if report:
                self.log_messages.insert(
                    0,
                    f"{datetime.now().strftime('%I:%M %p')}  report queued  {report[:40]}",
                )
                self.log_messages = self.log_messages[:20]
                self._refresh_dispatch_log()
                event.input.value = ""

    def action_ingest(self) -> None:
        input_widget = self.query_one("#telemetry-input", Input)
        reports = [r.strip() for r in input_widget.value.split("\n") if r.strip()]
        if not reports:
            return
        input_widget.value = ""

        async def _ingest():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"{API_BASE}/api/v1/telemetry/ingest",
                        json={"reports": reports},
                    )
                    data = resp.json()
                    self.log_messages.insert(
                        0,
                        f"{datetime.now().strftime('%I:%M %p')}  ingested {data.get('zones_normalized', 0)} zones",
                    )
                    self.log_messages = self.log_messages[:20]
                    self._refresh_dispatch_log()
                    self.total_claims = data.get("zones_saved", self.total_claims)
            except Exception as exc:
                self.log_messages.insert(
                    0,
                    f"{datetime.now().strftime('%I:%M %p')}  ingest error  {exc}",
                )
                self.log_messages = self.log_messages[:20]
                self._refresh_dispatch_log()

        self.run_worker(_ingest, exclusive=True)

    def action_optimize(self) -> None:
        reports = [
            "Roof is completely torn off, water is entering living areas",
            "Minor shingle damage on the garage",
            "Total loss, severe structural collapse",
        ]

        async def _optimize():
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{API_BASE}/api/v1/optimize/run",
                        json={
                            "reports": reports,
                            "available_units": 2,
                            "iterations": 2000,
                        },
                    )
                    data = resp.json()
                    self.optimization_result = data
                    deployed = sum(
                        1
                        for z in data.get("deployed_zones", [])
                        if z.get("deployed")
                    )
                    pending = sum(
                        1
                        for z in data.get("deployed_zones", [])
                        if not z.get("deployed")
                    )
                    self.deployed_units = deployed
                    self.pending_units = pending
                    self.log_messages.insert(
                        0,
                        f"{datetime.now().strftime('%I:%M %p')}  solver complete  energy {data.get('best_energy', 0):.2f}",
                    )
                    self.log_messages = self.log_messages[:20]
                    self._refresh_dispatch_log()
            except Exception as exc:
                self.log_messages.insert(
                    0,
                    f"{datetime.now().strftime('%I:%M %p')}  optimize error  {exc}",
                )
                self.log_messages = self.log_messages[:20]
                self._refresh_dispatch_log()

        self.run_worker(_optimize, exclusive=True)

    def action_refresh(self) -> None:
        self._render_claims_table()
        self._render_fleet()
        self._render_resource()
        now = datetime.now().strftime("%I:%M %p")
        self.log_messages.insert(0, f"{now}  data refreshed")
        self.log_messages = self.log_messages[:20]
        self._refresh_dispatch_log()


if __name__ == "__main__":
    app = CrisMinApp()
    app.run()

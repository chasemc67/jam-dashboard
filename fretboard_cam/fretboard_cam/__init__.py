"""Live guitar-neck overlay for Jam Dashboard."""

from .app import main
from .geometry import order_fretboard_corners, project_cell
from .overlay import OverlayConfig, draw_fretboard_overlay

__all__ = [
    "main",
    "OverlayConfig",
    "draw_fretboard_overlay",
    "order_fretboard_corners",
    "project_cell",
]

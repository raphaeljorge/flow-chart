import React, { useState, useEffect, useCallback } from "react";
import { NodeEditorController } from "../editor/app/NodeEditorController";
import {
    EditorPreferences,
    ConnectionRoutingMode,
    GridSettings,
} from "../editor/core/types";

interface PreferencesPanelProps {
    controller: NodeEditorController | null;
    isVisible: boolean;
    onClose: () => void;
}

const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
    controller,
    isVisible,
    onClose,
}) => {
    const [prefs, setPrefs] = useState<EditorPreferences | null>(null);

    useEffect(() => {
        if (controller) {
            const currentPrefs = controller.viewStore.getState().preferences;
            setPrefs(currentPrefs);

            const handleViewChange = (newState: any) => {
                setPrefs(newState.preferences);
            };

            controller.viewStore.on("viewchanged", handleViewChange);
            return () => {
                controller.viewStore.off("viewchanged", handleViewChange);
            };
        }
    }, [controller]);

    const handlePreferenceChange = useCallback(
        (key: keyof EditorPreferences, value: any) => {
            if (!controller || !prefs) return;

            let newPrefs: EditorPreferences;
            if (typeof value === "object" && !Array.isArray(value)) {
                newPrefs = {
                    ...prefs,
                    [key]: {
                        ...(prefs[key] as object),
                        ...value,
                    },
                };
            } else {
                newPrefs = { ...prefs, [key]: value };
            }

            controller.updatePreferences(newPrefs);
        },
        [controller, prefs]
    );

    const handleGridChange = (key: keyof GridSettings, value: any) => {
        handlePreferenceChange("grid", { [key]: value });
    };

    if (!isVisible || !prefs) {
        return null;
    }

    return (
        <div className="config-panel-wrapper visible">
            <div className="config-panel">
                <div className="config-panel-header">
                    <div className="config-panel-icon">
                        <i className="ph ph-gear-six"></i>
                    </div>
                    <div className="config-panel-title">
                        <h2>Editor Preferences</h2>
                        <p>Customize your workspace</p>
                    </div>
                    <button
                        className="config-panel-close"
                        title="Close Panel"
                        onClick={onClose}
                    >
                        <i className="ph ph-x"></i>
                    </button>
                </div>
                <div className="config-panel-content">
                    {/* --- Routing Section --- */}
                    <div className="config-section">
                        <h3>Connection Routing</h3>
                        <div className="form-group">
                            <label htmlFor="routing-mode">Routing Algorithm</label>
                            <select
                                id="routing-mode"
                                className="config-input"
                                value={prefs.connectionRouting}
                                onChange={(e) => handlePreferenceChange('connectionRouting', e.target.value as ConnectionRoutingMode)}
                            >
                                <option value={ConnectionRoutingMode.BEZIER}>
                                    Bézier Curves (Default)
                                </option>
                                <option value={ConnectionRoutingMode.STRAIGHT}>
                                    Straight Lines
                                </option>
                                <option value={ConnectionRoutingMode.ORTHOGONAL}>
                                    Orthogonal (Right-angle)
                                </option>
                                <option value={ConnectionRoutingMode.AUTO_ROUTED} disabled>
                                    Smart (Obstacle Avoidance)
                                </option>
                            </select>
                            <div className="help">
                                How connection lines are drawn between nodes.
                            </div>
                        </div>
                    </div>

                    {/* --- Grid Section --- */}
                    <div className="config-section">
                        <h3>Canvas Grid</h3>
                        <div className="form-group">
                            <label>Grid Pattern</label>
                            <select
                                id="grid-pattern"
                                className="config-input"
                                value={prefs.grid.pattern}
                                onChange={(e) => handleGridChange("pattern", e.target.value)}
                            >
                                <option value="dots">Dots</option>
                                <option value="lines">Lines</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <div className="checkbox-group">
                                <input
                                    type="checkbox"
                                    id="snap-to-grid"
                                    checked={prefs.grid.snapToGrid}
                                    onChange={(e) =>
                                        handleGridChange("snapToGrid", e.target.checked)
                                    }
                                />
                                <label htmlFor="snap-to-grid">Snap to Grid</label>
                            </div>
                        </div>
                    </div>

                    {/* --- Appearance Section --- */}
                    <div className="config-section">
                        <h3>Connection Appearance</h3>
                        <div className="form-group">
                            <div className="checkbox-group">
                                <input
                                    type="checkbox"
                                    id="animate-flow"
                                    checked={prefs.connectionAppearance.animateFlow}
                                    onChange={(e) => {
                                        handlePreferenceChange("connectionAppearance", {
                                            animateFlow: e.target.checked,
                                        });
                                        // Force a re-render to start/stop animations
                                        controller?.canvasEngine.requestRender();
                                    }}
                                />
                                <label htmlFor="animate-flow">Animate Data Flow</label>
                            </div>
                            <div className="help">
                                Shows a visual indicator of data flow on connections.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreferencesPanel;
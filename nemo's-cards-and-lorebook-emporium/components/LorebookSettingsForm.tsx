
import React, { useState } from 'react';
import type { LorebookSettings } from '../types';
import Tooltip from './Tooltip';

interface LorebookSettingsFormProps {
    settings: LorebookSettings;
    setSettings: (settings: LorebookSettings) => void;
    disabled: boolean;
}

const NumberInput: React.FC<{ id: string; value: number; onChange: (value: number) => void; min?: number; max?: number; disabled?: boolean }> = 
({ id, value, onChange, min = 1, max = 20, disabled = false }) => (
    <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-sepia">Count:</label>
        <input
            id={id}
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-20 p-1 text-sm bg-parchment-dark border-sepia-light rounded-md text-sepia-dark disabled:opacity-50 text-center"
            disabled={disabled}
        />
    </div>
);


const LorebookSettingsForm: React.FC<LorebookSettingsFormProps> = ({ settings, setSettings, disabled }) => {
    const handleSettingChange = (category: keyof LorebookSettings, key: string, value: any) => {
        setSettings({
            ...settings,
            [category]: {
                // @ts-ignore
                ...settings[category],
                [key]: value,
            },
        });
    };

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-4 space-y-4">
            {/* Alternate Greetings */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.alternateGreetings.enabled}
                        onChange={(e) => handleSettingChange('alternateGreetings', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.alternateGreetings.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Alternate Greetings</label>
                    <Tooltip text="Generate multiple starting messages for the character to increase variety." />
                </div>
                 <div className={`transition-opacity ${settings.alternateGreetings.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <NumberInput id="alt-greetings-count" value={settings.alternateGreetings.count} onChange={(v) => handleSettingChange('alternateGreetings', 'count', v)} max={10} disabled={!settings.alternateGreetings.enabled} />
                </div>
            </div>

            {/* Lorebook Content Header */}
            <div className="pt-4 border-t border-leather/20">
                <p className="text-md font-medium text-sepia-dark mb-2">Lorebook Content</p>
            </div>
            
            {/* Key NPCs */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.keyNPCs.enabled}
                        onChange={(e) => handleSettingChange('keyNPCs', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.keyNPCs.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Key NPCs</label>
                    <Tooltip text="Major characters in the story who are important to your character. Each will get a detailed entry." />
                </div>
                 <div className={`transition-opacity ${settings.keyNPCs.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <NumberInput id="key-npcs-count" value={settings.keyNPCs.count} onChange={(v) => handleSettingChange('keyNPCs', 'count', v)} max={10} disabled={!settings.keyNPCs.enabled} />
                </div>
            </div>
            
            {/* Minor NPCs */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.minorNPCs.enabled}
                        onChange={(e) => handleSettingChange('minorNPCs', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.minorNPCs.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Minor NPCs</label>
                     <Tooltip text="Background characters that flesh out the world. They will have shorter, more concise descriptions." />
                </div>
                 <div className={`transition-opacity ${settings.minorNPCs.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <NumberInput id="minor-npcs-count" value={settings.minorNPCs.count} onChange={(v) => handleSettingChange('minorNPCs', 'count', v)} max={20} disabled={!settings.minorNPCs.enabled} />
                </div>
            </div>

            {/* Locations */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.locations.enabled}
                        onChange={(e) => handleSettingChange('locations', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.locations.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Locations</label>
                    <Tooltip text="Create lorebook entries for significant places in the character's world." />
                </div>
                 <div className={`transition-opacity ${settings.locations.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <NumberInput id="locations-count" value={settings.locations.count} onChange={(v) => handleSettingChange('locations', 'count', v)} max={20} disabled={!settings.locations.enabled} />
                </div>
            </div>

            {/* Factions */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.factions.enabled}
                        onChange={(e) => handleSettingChange('factions', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.factions.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Factions & Organizations</label>
                    <Tooltip text="Generate entries for guilds, kingdoms, corporations, or other groups that influence the world." />
                </div>
                 <div className={`transition-opacity ${settings.factions.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <NumberInput id="factions-count" value={settings.factions.count} onChange={(v) => handleSettingChange('factions', 'count', v)} max={10} disabled={!settings.factions.enabled} />
                </div>
            </div>

            {/* World Mechanics */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-x-3">
                        <input
                            type="checkbox"
                            checked={settings.worldMechanics.enabled}
                            onChange={(e) => handleSettingChange('worldMechanics', 'enabled', e.target.checked)}
                            className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                        />
                        <label className={`font-medium ${settings.worldMechanics.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Core World Mechanics</label>
                        <Tooltip text="Define the fundamental rules of your world, such as magic systems, technology levels, or physical laws." />
                    </div>
                    <div className={`transition-opacity ${settings.worldMechanics.enabled ? 'opacity-100' : 'opacity-50'}`}>
                        <NumberInput id="mechanics-count" value={settings.worldMechanics.count} onChange={(v) => handleSettingChange('worldMechanics', 'count', v)} max={15} disabled={!settings.worldMechanics.enabled} />
                    </div>
                </div>
                <div className={`pl-8 transition-opacity ${settings.worldMechanics.enabled ? 'opacity-100' : 'opacity-50'}`}>
                    <textarea
                        rows={2}
                        placeholder="Optional: Guide the AI on what mechanics to create (e.g., 'Focus on a magic system based on emotions')."
                        value={settings.worldMechanics.prompt}
                        onChange={(e) => handleSettingChange('worldMechanics', 'prompt', e.target.value)}
                        className="w-full p-2 text-sm bg-parchment-dark/70 border-sepia-light rounded-md text-sepia-dark disabled:opacity-50 placeholder:text-sepia-light"
                        disabled={!settings.worldMechanics.enabled}
                    />
                </div>
            </div>

            {/* Roleplaying Engine */}
             <div className="flex justify-between items-center pt-4 border-t border-leather/20">
                <div className="flex items-center gap-x-3">
                     <input
                        type="checkbox"
                        checked={settings.roleplayingEngine.enabled}
                        onChange={(e) => handleSettingChange('roleplayingEngine', 'enabled', e.target.checked)}
                        className="h-5 w-5 rounded bg-parchment-dark border-sepia-light text-leather focus:ring-leather"
                    />
                    <label className={`font-medium ${settings.roleplayingEngine.enabled ? 'text-sepia-dark' : 'text-sepia-light'}`}>Roleplaying Engine</label>
                    <Tooltip text="Creates a set of specialized lorebook entries (like <INIT>, <BEAT>, <ANCHOR>) to help guide the AI's roleplaying style and track story elements." />
                </div>
            </div>
        </div>
    );
};

export default LorebookSettingsForm;
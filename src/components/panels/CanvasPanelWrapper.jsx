import React from 'react';
import { T } from '../../utils/theme.js';
import OnwardPanel from '../OnwardPanel.jsx';
import MapPanel from '../MapPanel.jsx';
import SkillsPanel from '../SkillsPanel.jsx';

export default function CanvasPanelWrapper({ panelId, ...props }) {
  return (
    <>
      <div className="wp-accent" style={{ background: T.accent }} />
      <div className="wp-hd">
        <button className="wp-close" onClick={props.closeWaypoint}>×</button>
        <div className="wp-badge"><span style={{ color:T.muted }}>Canvas</span></div>
        <div className="wp-ttl" style={{ color:T.accent }}>{panelId.toUpperCase()}</div>
      </div>
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {panelId === 'onward' && (
          <OnwardPanel
            onwardItems={props.onwardItems}
            onwardForm={props.onwardForm}
            setOnwardForm={props.setOnwardForm}
            projects={props.projects}
            onAdd={props.addOnwardItem}
            onDelete={props.deleteOnwardItem}
            onToggleDone={props.toggleOnwardDone}
            selectedId={props.selectedId}
            onSelectGoal={id => { props.setSelectedId(id); props.openWaypoint({ type:'goal', id }); }}
            onToggleFocus={props.toggleFocus}
            onConfirmDelete={props.setConfirmDelete}
            availableTasks={props.availableTasks}
            onDeleteAvailableTask={props.deleteAvailableTask}
            onDragStart={task => props.setDraggedTask(task)}
            onMoveItem={props.moveOnwardItem}
            onStartFocus={props.handleStartFocus}
            onReturnToAvailable={props.returnOnwardItemToAvailable}
            backlogItems={props.backlogItems}
            deferredItems={props.deferredItems}
            selectedForToday={props.selectedForToday}
            onRestoreFromBacklog={props.handleRestoreFromBacklog}
            // Plan props
            novaState={props.novaState}
            prioritizeInput={props.prioritizeInput}
            setPrioritizeInput={props.setPrioritizeInput}
            generateNovaPlan={props.generateNovaPlan}
            apiKey={props.apiKey}
          />
        )}
        {panelId === 'map' && (
          <MapPanel
            hoveredWeek={props.hoveredWeek}
            projects={props.projects}
            weeklyInsights={props.novaState?.weeklyInsights}
            onWeeklyCheckin={props.scanWeeklyGoals}
            companionLoading={props.novaState?.weeklyInsights?.loading || false}
          />
        )}
        {panelId === 'skills' && (
          <SkillsPanel
            skills={props.skills}
            selectedSkillId={props.selectedSkillId}
            onUpdateLevel={props.updateSkillLevel}
            onAddSubskill={props.addSubskill}
          />
        )}
      </div>
    </>
  );
}

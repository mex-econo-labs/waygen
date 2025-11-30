import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const downloadKMZ = async (waypoints, settings, filename = "MiniMission", sessionData = null) => {
  const zip = new JSZip();
  const now = Date.now();
  const { 
    speed, 
    straightenLegs, 
    waypointAction, 
    gimbalPitch, 
    missionEndAction, 
    rcLostAction, 
    globalTransitionalSpeed 
  } = settings;

  // 1. template.kml
  const templateXML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${missionEndAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${rcLostAction || 'hover'}</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${globalTransitionalSpeed !== undefined ? globalTransitionalSpeed : speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <wpml:templateId>0</wpml:templateId>
  </Document>
</kml>`;

  // 2. waylines.wpml
  let placemarks = "";
  waypoints.forEach((wp, i) => {
    const isFirst = i === 0;
    const isLast = i === waypoints.length - 1;
    const actionId = i + 1;

    // Determine effective values (waypoint override > global setting)
    const effectiveStraightenLegs = wp.straightenLegs !== undefined ? wp.straightenLegs : straightenLegs;
    const effectiveAction = wp.action !== undefined ? wp.action : waypointAction;
    const effectiveGimbalPitch = wp.gimbalPitch !== undefined ? wp.gimbalPitch : gimbalPitch;
    const effectiveSpeed = wp.speed !== undefined ? wp.speed : speed;

    // Action Generation Logic
    let actions = "";
    let actionCount = 0;

    // 1. Gimbal Action (Always on first point, or if pitch changes)
    const prevWp = i > 0 ? waypoints[i - 1] : null;
    const prevEffectivePitch = prevWp ? (prevWp.gimbalPitch !== undefined ? prevWp.gimbalPitch : gimbalPitch) : null;

    if (isFirst || (prevEffectivePitch !== null && effectiveGimbalPitch !== prevEffectivePitch)) {
      actions += `
        <wpml:action>
          <wpml:actionId>${actionCount++}</wpml:actionId>
          <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
          <wpml:actionActuatorFuncParam>
            <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
            <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
            <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
            <wpml:gimbalPitchRotateAngle>${effectiveGimbalPitch}</wpml:gimbalPitchRotateAngle>
            <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
            <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
            <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
          </wpml:actionActuatorFuncParam>
        </wpml:action>`;
    }

    // 2. Waypoint Actions (Photo/Record)
    if (effectiveAction === 'photo') {
      actions += `
        <wpml:action>
          <wpml:actionId>${actionCount++}</wpml:actionId>
          <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
          <wpml:actionActuatorFuncParam>
            <wpml:fileSuffix>point${i}</wpml:fileSuffix>
            <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
          </wpml:actionActuatorFuncParam>
        </wpml:action>`;
    } else if (effectiveAction === 'record_start') {
      actions += `
          <wpml:action>
            <wpml:actionId>${actionCount++}</wpml:actionId>
            <wpml:actionActuatorFunc>startRecord</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:fileSuffix>mission</wpml:fileSuffix>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
    } else if (effectiveAction === 'record_stop') {
      actions += `
          <wpml:action>
            <wpml:actionId>${actionCount++}</wpml:actionId>
            <wpml:actionActuatorFunc>stopRecord</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
    } else if (effectiveAction === 'record') {
      // Legacy/Global behavior
      if (isFirst) {
        actions += `
            <wpml:action>
              <wpml:actionId>${actionCount++}</wpml:actionId>
              <wpml:actionActuatorFunc>startRecord</wpml:actionActuatorFunc>
              <wpml:actionActuatorFuncParam>
                <wpml:fileSuffix>mission</wpml:fileSuffix>
                <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              </wpml:actionActuatorFuncParam>
            </wpml:action>`;
      } else if (isLast) {
        actions += `
            <wpml:action>
              <wpml:actionId>${actionCount++}</wpml:actionId>
              <wpml:actionActuatorFunc>stopRecord</wpml:actionActuatorFunc>
              <wpml:actionActuatorFuncParam>
                <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              </wpml:actionActuatorFuncParam>
            </wpml:action>`;
      }
    }

    const actionGroupXML = actionCount > 0 ? `
      <wpml:actionGroup>
        <wpml:actionGroupId>${actionId}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger>
          <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
        </wpml:actionTrigger>
        ${actions}
      </wpml:actionGroup>` : "";

    // Determine turn mode and heading params based on straight vs curved
    let waypointTurnMode = 'toPointAndPassWithContinuityCurvature';
    let useStraightLine = 0;

    if (effectiveStraightenLegs) {
      waypointTurnMode = 'toPointAndStopWithDiscontinuityCurvature';
      useStraightLine = 1;
    } else {
      // Curved logic
      useStraightLine = 0;
      if (isFirst || isLast) {
        waypointTurnMode = 'toPointAndStopWithContinuityCurvature';
      } else {
        waypointTurnMode = 'toPointAndPassWithContinuityCurvature';
      }
    }

    placemarks += `
    <Placemark>
      <Point><coordinates>${wp.lng},${wp.lat},0</coordinates></Point>
      <wpml:index>${i}</wpml:index>
      <wpml:executeHeight>${wp.altitude}</wpml:executeHeight>
      <wpml:waypointSpeed>${effectiveSpeed}</wpml:waypointSpeed>
      <wpml:waypointHeadingParam>
        <wpml:waypointHeadingMode>smoothTransition</wpml:waypointHeadingMode>
        <wpml:waypointHeadingAngle>${wp.heading}</wpml:waypointHeadingAngle>
        <wpml:waypointHeadingAngleEnable>0</wpml:waypointHeadingAngleEnable>
        <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
      </wpml:waypointHeadingParam>
      <wpml:waypointTurnParam>
        <wpml:waypointTurnMode>${waypointTurnMode}</wpml:waypointTurnMode>
        <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
      </wpml:waypointTurnParam>
      <wpml:useStraightLine>${useStraightLine}</wpml:useStraightLine>
      ${actionGroupXML}
    </Placemark>`;
  });

  const waylinesXML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${missionEndAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${rcLostAction || 'hover'}</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${globalTransitionalSpeed !== undefined ? globalTransitionalSpeed : speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${speed}</wpml:autoFlightSpeed>
      ${placemarks}
    </Folder>
  </Document>
</kml>`;

  const wpmz = zip.folder("wpmz");
  wpmz.file("template.kml", templateXML);
  wpmz.file("waylines.wpml", waylinesXML);

  // 3. Store Session Data (Settings + Polygon)
  if (sessionData) {
    zip.file("waygen_session.json", JSON.stringify(sessionData, null, 2));
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${filename}.kmz`);
};

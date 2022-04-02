const { GfxScene, GfxCamera, GfxMaterial, GfxModel, GfxNodeRenderer, GfxNodeRendererTransform } = require("../gl/scene.js")
const { ModelBuilder } = require("../util/modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")
const { Mat4 } = require("../math/mat4.js")
const { Geometry } = require("../math/geometry.js")

class ViewerAreas
{
	constructor(window, viewer, data)
	{
		this.window = window
		this.viewer = viewer
		this.data = data
		
		this.scene = new GfxScene()
		this.sceneAfter = new GfxScene()
		
		this.hoveringOverPoint = null
		this.linkingPoints = false
		
		this.modelPoint = new ModelBuilder()
			.addSphere(-150, -150, -150, 150, 150, 150)
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelPointSelection = new ModelBuilder()
			.addSphere(-250, -250, 250, 250, 250, -250)
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelPath = new ModelBuilder()
			.addCylinder(-150, -150, 0, 150, 150, 1000, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelArrow = new ModelBuilder()
			.addCone(-250, -250, 1000, 250, 250, 1300, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelArrowUp = new ModelBuilder()
			.addCone(-150, -150, 600, 150, 150, 1500, 8, new Vec3(0, 0.01, 1).normalize())
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelSizeCylinde = new ModelBuilder()
			.addCylinder(-1, -1, -1, 1, 1, 1, 8)
			.calculateNormals()
			.makeModel(viewer.gl)

		this.modelSizeBox = new ModelBuilder()
			.addCube(-1, -1, -1, 1, 1, 1, 1, 8)
			.calculateNormals()
			.makeModel(viewer.gl)

		this.renderers = []
	}
	
	
	setData(data)
	{
		this.data = data
		this.refresh()
	}
	
	
	destroy()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
	}
	
	
	refreshPanels()
	{
		let panel = this.window.addPanel("Areas", false, (open) => { if (open) this.viewer.setSubviewer(this) })
		this.panel = panel
	
		panel.addText(null, "<strong>Hold Alt + Click:</strong> Create Object")
		panel.addText(null, "<strong>Hold Alt + Drag Object:</strong> Duplicate Object")
		panel.addText(null, "<strong>Hold Ctrl:</strong> Multiselect")
		panel.addButton(null, "(A) Select/Unselect All", () => this.toggleAllSelection())
		panel.addButton(null, "(X) Delete Selected", () => this.deleteSelectedPoints())
		
		let selectedPoints = this.data.areas.nodes.filter(p => p.selected)
		
		let selectionGroup = panel.addGroup(null, "Selection:")
		let enabled = (selectedPoints.length > 0)
		let multiedit = (selectedPoints.length > 1)
		
		let shapes =
		[
			{ str: "Box", value: 0 },
			{ str: "Cylinder", value: 1 },
		]
		panel.addSelectionDropdown(selectionGroup, "Shape", selectedPoints.map(p =>  p.shape), shapes, true, false, (x, i) => { this.window.setNotSaved(); selectedPoints[i].shape = x })
		let types =
		[
			{ str: "Camera", value: 0 },
			{ str: "EnvEffect", value: 1 },
			{ str: "BFG Entry Swapper", value: 2 },
			{ str: "Moving Road", value: 3 },
			{ str: "Destination Point", value: 4 },
			{ str: "Minimap Control", value: 5 },
			{ str: "Music Changer", value: 6 },
			{ str: "Flying Boos", value: 7 },
			{ str: "Object Grouper", value: 8 },
			{ str: "Group Unloading", value: 9 },
			{ str: "Fall Boundary", value: 10 },
		]
		panel.addSelectionDropdown(selectionGroup, "Type", selectedPoints.map(p =>  p.type), types, true, false, (x, i) => { this.window.setNotSaved(); selectedPoints[i].type = x })

		panel.addSelectionNumericInput(selectionGroup,       "X", -1000000, 1000000, selectedPoints.map(p =>  p.pos.x),      null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.x = x })
		panel.addSelectionNumericInput(selectionGroup,       "Y", -1000000, 1000000, selectedPoints.map(p => -p.pos.z),      null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.z = -x })
		panel.addSelectionNumericInput(selectionGroup,       "Z", -1000000, 1000000, selectedPoints.map(p => -p.pos.y),      null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.y = -x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. X", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.x), null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.x = x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Y", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.y), null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.y = x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Z", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.z), null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.z = x })
		panel.addSelectionNumericInput(selectionGroup, "Scale X", -1000000, 1000000, selectedPoints.map(p =>  p.scale.x),    null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].scale.x = x })
		panel.addSelectionNumericInput(selectionGroup, "Scale Y", -1000000, 1000000, selectedPoints.map(p =>  p.scale.z),    null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].scale.z = x })
		panel.addSelectionNumericInput(selectionGroup, "Scale Z", -1000000, 1000000, selectedPoints.map(p =>  p.scale.y),    null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].scale.y = x })
		panel.addSelectionNumericInput(selectionGroup,      "Camera", 0, 0xff      , selectedPoints.map(p => p.cameraIndex),     1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].cameraIndex = x })
		panel.addSelectionNumericInput(selectionGroup,    "Priority", 0, 0xff      , selectedPoints.map(p => p.priority),        1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].priority = x })
		panel.addSelectionNumericInput(selectionGroup,    "Setting1", 0, 0xffff    , selectedPoints.map(p => p.setting1),        1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].setting1 = x })
		panel.addSelectionNumericInput(selectionGroup,    "Setting2", 0, 0xffff    , selectedPoints.map(p => p.setting2),        1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].setting2 = x })
		panel.addSelectionNumericInput(selectionGroup,       "Route", 0, 0xff      , selectedPoints.map(p => p.routeIndex),      1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].routeIndex = x })
		panel.addSelectionNumericInput(selectionGroup, "Enemy point", 0, 0xff      , selectedPoints.map(p => p.enemyPointIndex), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].enemyPointIndex = x })
		panel.addSelectionNumericInput(selectionGroup,     "unk0x2E", 0, 0xffff    , selectedPoints.map(p => p.unk0x2E),         1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].unk0x2E = x })
	}
	
	
	refresh()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
		
		for (let point of this.data.areas.nodes)
		{
			if (point.selected === undefined)
			{
				point.selected = false
				point.moveOrigin = point.pos
			}
			
			point.renderer = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
			
			point.rendererSelected = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelPointSelection)
				.setMaterial(this.viewer.materialUnshaded)
				.setEnabled(false)

			point.rendererSizeCylinder = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelSizeCylinde)
				.setMaterial(this.viewer.materialUnshaded)

			point.rendererSizeBox = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelSizeBox)
				.setMaterial(this.viewer.materialUnshaded)
				
			point.rendererSelectedCore = new GfxNodeRenderer()
				.attach(point.rendererSelected)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
				
			this.renderers.push(point.renderer)
			this.renderers.push(point.rendererSizeCylinder)
			this.renderers.push(point.rendererSizeBox)
			this.renderers.push(point.rendererSelected)
		}
		
		this.refreshPanels()
	}
	
	
	getHoveringOverElement(cameraPos, ray, distToHit, includeSelected = true)
	{
		let elem = null
		
		let minDistToCamera = distToHit + 1000
		let minDistToPoint = 1000000
		for (let point of this.data.areas.nodes)
		{
			if (!includeSelected && point.selected)
				continue
			
			let distToCamera = point.pos.sub(cameraPos).magn()
			if (distToCamera >= minDistToCamera)
				continue
			
			let scale = this.viewer.getElementScale(point.pos)
			
			let pointDistToRay = Geometry.linePointDistance(ray.origin, ray.direction, point.pos)
			
			if (pointDistToRay < 150 * scale * 4 && pointDistToRay < minDistToPoint)
			{
				elem = point
				minDistToCamera = distToCamera
				minDistToPoint = pointDistToRay
			}
		}
		
		return elem
	}
	
	
	selectAll()
	{
		for (let point of this.data.areas.nodes)
			point.selected = true
		
		this.refreshPanels()
	}
	
	
	unselectAll()
	{
		for (let point of this.data.areas.nodes)
			point.selected = false
		
		this.refreshPanels()
	}
	
	
	toggleAllSelection()
	{
		let hasSelection = (this.data.areas.nodes.find(p => p.selected) != null)
		
		if (hasSelection)
			this.unselectAll()
		else
			this.selectAll()
	}
	
	
	deleteSelectedPoints()
	{
		let pointsToDelete = []
		
		for (let point of this.data.areas.nodes)
		{
			if (!point.selected)
				continue
			
			pointsToDelete.push(point)
		}
		
		for (let point of pointsToDelete)
			this.data.areas.removeNode(point)
		
		this.refresh()
		this.window.setNotSaved()
		this.window.setUndoPoint()
	}
	
	
	onKeyDown(ev)
	{
		switch (ev.key)
		{
			case "A":
			case "a":
				this.toggleAllSelection()
				return true
			
			case "Backspace":
			case "Delete":
			case "X":
			case "x":
				this.deleteSelectedPoints()
				return true
		}
		
		return false
	}
	
	
	onMouseDown(ev, x, y, cameraPos, ray, hit, distToHit, mouse3DPos)
	{
		this.linkingPoints = false
		
		for (let point of this.data.areas.nodes)
			point.moveOrigin = point.pos
		
		let hoveringOverElem = this.getHoveringOverElement(cameraPos, ray, distToHit)
		
		if (ev.altKey || (!ev.ctrlKey && (hoveringOverElem == null || !hoveringOverElem.selected)))
			this.unselectAll()
		
		if (hoveringOverElem != null)
		{
			if (ev.altKey)
			{
				let newPoint = this.data.areas.addNode()
				newPoint.pos = hoveringOverElem.pos.clone()
				newPoint.rotation = hoveringOverElem.rotation.clone()
				newPoint.scale = hoveringOverElem.scale.clone()
				newPoint.shape = hoveringOverElem.shape
				newPoint.type = hoveringOverElem.type
				newPoint.cameraIndex = hoveringOverElem.cameraIndex
				newPoint.priority = hoveringOverElem.priority
				newPoint.setting1 = hoveringOverElem.setting1
				newPoint.setting2 = hoveringOverElem.setting2
				newPoint.routeIndex = hoveringOverElem.routeIndex
				newPoint.enemyPointIndex = hoveringOverElem.enemyPointIndex
				newPoint.unk0x2E = hoveringOverElem.unk0x2E
				
				this.refresh()
				
				newPoint.selected = true
				this.viewer.setCursor("-webkit-grabbing")
				this.refreshPanels()
				this.window.setNotSaved()
			}
			else
			{
				hoveringOverElem.selected = true
				this.refreshPanels()
				this.viewer.setCursor("-webkit-grabbing")
			}
		}
		else if (ev.altKey)
		{
			let newPoint = this.data.areas.addNode()
			newPoint.pos = mouse3DPos
			
			this.refresh()
			newPoint.selected = true
			this.viewer.setCursor("-webkit-grabbing")
			this.refreshPanels()
			this.window.setNotSaved()
		}
	}
	
	
	onMouseMove(ev, x, y, cameraPos, ray, hit, distToHit)
	{
		if (!this.viewer.mouseDown)
		{
			let lastHover = this.hoveringOverPoint
			this.hoveringOverPoint = this.getHoveringOverElement(cameraPos, ray, distToHit)
			
			if (this.hoveringOverPoint != null)
				this.viewer.setCursor("-webkit-grab")
			
			if (this.hoveringOverPoint != lastHover)
				this.viewer.render()
		}
		else
		{
			if (this.viewer.mouseAction == "move")
			{
				let linkToPoint = this.getHoveringOverElement(cameraPos, ray, distToHit, false)
				
				for (let point of this.data.areas.nodes)
				{
					if (!point.selected)
						continue
					
					this.window.setNotSaved()
					this.viewer.setCursor("-webkit-grabbing")
					
					if (this.linkingPoints && linkToPoint != null)
					{
						point.pos = linkToPoint.pos
					}
					else
					{					
						let screenPosMoved = this.viewer.pointToScreen(point.moveOrigin)
						screenPosMoved.x += this.viewer.mouseMoveOffsetPixels.x
						screenPosMoved.y += this.viewer.mouseMoveOffsetPixels.y
						let pointRayMoved = this.viewer.getScreenRay(screenPosMoved.x, screenPosMoved.y)
						
						let hit = this.viewer.collision.raycast(pointRayMoved.origin, pointRayMoved.direction)
						if (hit != null)
							point.pos = hit.position
						else
						{
							let screenPos = this.viewer.pointToScreen(point.moveOrigin)
							let pointRay = this.viewer.getScreenRay(screenPos.x, screenPos.y)
							let origDistToScreen = point.moveOrigin.sub(pointRay.origin).magn()
							
							point.pos = pointRayMoved.origin.add(pointRayMoved.direction.scale(origDistToScreen))
						}
					}
				}
				
				this.refreshPanels()
			}
		}
	}
	
	
	onMouseUp(ev, x, y)
	{
		
	}
	
	
	drawAfterModel()
	{
		for (let point of this.data.areas.nodes)
		{
			let scale = (this.hoveringOverPoint == point ? 1.5 : 1) * this.viewer.getElementScale(point.pos)
			
			point.renderer
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0, 0, 1, 1])
				
			point.rendererSelected
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0, 0.5, 1, 1])
				.setEnabled(point.selected)
			
			point.rendererSelectedCore
				.setDiffuseColor([0, 0, 0.75, 1])

			let scaled = {}
			scaled.x = point.scale.x * 5000
			scaled.y = point.scale.y * 10000
			scaled.z = point.scale.z * 5000

			let areaScale = point.shape == 0 ? 1.0 : 0.0
			let matrixDirection =
				Mat4.scale(scaled.x * areaScale, scaled.y * areaScale, scaled.z * areaScale)
				.mul(Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(1, 0, 0), point.rotation.x * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 0, 1), -point.rotation.y * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 1, 0), -point.rotation.z * Math.PI / 180))
				.mul(Mat4.translation(point.pos.x, point.pos.y, point.pos.z))
			point.rendererSizeBox
				.setCustomMatrix(matrixDirection)
				.setDiffuseColor([0.25, 0.0, 1.0, 0.5])

			areaScale = point.shape == 1 ? 1.0 : 0.0
			matrixDirection =
				Mat4.scale(scaled.x * areaScale, scaled.y * areaScale, scaled.z * areaScale)
				.mul(Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(1, 0, 0), point.rotation.x * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 0, 1), -point.rotation.y * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 1, 0), -point.rotation.z * Math.PI / 180))
				.mul(Mat4.translation(point.pos.x, point.pos.y, point.pos.z))
			point.rendererSizeCylinder
				.setCustomMatrix(matrixDirection)
				.setDiffuseColor([0.25, 0.0, 1.0, 0.5])

		}
		
		this.scene.render(this.viewer.gl, this.viewer.getCurrentCamera())
		this.sceneAfter.clearDepth(this.viewer.gl)
		this.sceneAfter.render(this.viewer.gl, this.viewer.getCurrentCamera())
	}
}


if (module)
	module.exports = { ViewerAreas }